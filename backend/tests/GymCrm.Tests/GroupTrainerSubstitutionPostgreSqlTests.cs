using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class GroupTrainerSubstitutionPostgreSqlTests(
    GroupTrainerSubstitutionPostgreSqlTests.PostgreSqlFixture fixture)
    : IClassFixture<GroupTrainerSubstitutionPostgreSqlTests.PostgreSqlFixture>
{
    private const string Password = "task073-postgres-password";
    private const string SubstitutionEntityType = "GroupTrainerSubstitution";
    private static readonly DateOnly BusinessDate = new(2026, 7, 25);
    private static readonly DateTimeOffset SeededAt = new(2026, 7, 20, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Clean_initial_migration_installs_extension_check_and_exclusion_constraints()
    {
        await using var context = await CreateContextAsync();

        await using var db = context.CreateDbContext();
        var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
        Assert.Contains(
            appliedMigrations,
            migration => migration.EndsWith("_InitialCreate", StringComparison.Ordinal));

        await using var connection = new NpgsqlConnection(context.ConnectionString);
        await connection.OpenAsync();

        Assert.True(await ScalarAsync<bool>(
            connection,
            """SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')"""));

        var checkDefinition = await ScalarAsync<string>(
            connection,
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conname = 'CK_GroupTrainerSubstitutions_Period_Inclusive'
            """);
        Assert.Contains("\"EndsOn\" >= \"StartsOn\"", checkDefinition, StringComparison.Ordinal);

        var exclusionDefinition = await ScalarAsync<string>(
            connection,
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conname = 'EX_GroupTrainerSubstitutions_GroupTrainer_Period_NoOverlap'
            """);
        Assert.Contains("EXCLUDE USING gist", exclusionDefinition, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("daterange", exclusionDefinition, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"CancelledAt\" IS NULL", exclusionDefinition, StringComparison.Ordinal);

        db.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = context.Seeded.GroupId,
            SubstituteTrainerId = context.Seeded.SubstituteTrainerId,
            StartsOn = BusinessDate.AddDays(2),
            EndsOn = BusinessDate.AddDays(1),
            CreatedByUserId = context.Seeded.ManagerId,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        });

        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal("23514", postgresException.SqlState);
        Assert.Equal("CK_GroupTrainerSubstitutions_Period_Inclusive", postgresException.ConstraintName);
    }

    [Fact]
    public async Task Legacy_create_route_is_absent_and_does_not_write_or_audit()
    {
        await using var context = await CreateContextAsync();
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        var payload = new UpsertPayload(
            context.Seeded.SubstituteTrainerId,
            "2026-07-26",
            "2026-07-28");
        var endpoint = $"/groups/{context.Seeded.GroupId}/trainer-substitutions";

        using var response = await PostJsonAsync(client, endpoint, payload, csrf);
        AssertLegacyMutationRouteAbsent(response);

        await using var db = context.CreateDbContext();
        Assert.Empty(await db.GroupTrainerSubstitutions.AsNoTracking().ToArrayAsync());
        Assert.Empty(await LoadSubstitutionAuditsAsync(db));
    }

    [Fact]
    public async Task Legacy_update_route_is_absent_and_preserves_existing_rows()
    {
        await using var context = await CreateContextAsync();
        var firstId = await context.SeedSubstitutionAsync(
            BusinessDate.AddDays(1),
            BusinessDate.AddDays(2));
        var secondId = await context.SeedSubstitutionAsync(
            BusinessDate.AddDays(5),
            BusinessDate.AddDays(6));
        var originalStates = await context.LoadSubstitutionsAsync();
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        var payload = new UpsertPayload(
            context.Seeded.SubstituteTrainerId,
            "2026-07-26",
            "2026-07-29");
        var endpoint = $"/groups/{context.Seeded.GroupId}/trainer-substitutions/{firstId}";

        using var response = await PutJsonAsync(client, endpoint, payload, csrf);
        AssertLegacyMutationRouteAbsent(response);

        await using var db = context.CreateDbContext();
        var stored = await db.GroupTrainerSubstitutions
            .AsNoTracking()
            .OrderBy(substitution => substitution.Id)
            .ToArrayAsync();
        Assert.Equal(2, stored.Length);
        foreach (var substitution in stored)
        {
            AssertSubstitutionState(originalStates[substitution.Id], substitution);
        }

        Assert.Empty(await LoadSubstitutionAuditsAsync(db));
    }

    [Fact]
    public async Task Legacy_cancel_route_is_absent_and_preserves_existing_row()
    {
        await using var context = await CreateContextAsync();
        var substitutionId = await context.SeedSubstitutionAsync(
            BusinessDate.AddDays(1),
            BusinessDate.AddDays(3));
        var original = (await context.LoadSubstitutionsAsync())[substitutionId];
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        var endpoint = $"/groups/{context.Seeded.GroupId}/trainer-substitutions/{substitutionId}/cancel";

        using var response = await PostWithoutBodyAsync(client, endpoint, csrf);
        AssertLegacyMutationRouteAbsent(response);

        await using var db = context.CreateDbContext();
        var stored = await db.GroupTrainerSubstitutions.AsNoTracking().SingleAsync();
        AssertSubstitutionState(original, stored);
        Assert.Empty(await LoadSubstitutionAuditsAsync(db));
    }

    [Fact]
    public async Task Legacy_update_and_cancel_routes_are_absent_without_lifecycle_mutation()
    {
        await using var context = await CreateContextAsync();
        var substitutionId = await context.SeedSubstitutionAsync(
            BusinessDate.AddDays(1),
            BusinessDate.AddDays(3));
        var original = (await context.LoadSubstitutionsAsync())[substitutionId];
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        var endpoint = $"/groups/{context.Seeded.GroupId}/trainer-substitutions/{substitutionId}";
        var updatePayload = new UpsertPayload(
            context.Seeded.SubstituteTrainerId,
            "2026-07-26",
            "2026-07-29");

        using var update = await PutJsonAsync(client, endpoint, updatePayload, csrf);
        AssertLegacyMutationRouteAbsent(update);
        using var cancel = await PostWithoutBodyAsync(client, $"{endpoint}/cancel", csrf);
        AssertLegacyMutationRouteAbsent(cancel);

        await using var db = context.CreateDbContext();
        var stored = await db.GroupTrainerSubstitutions.AsNoTracking().SingleAsync();
        AssertSubstitutionState(original, stored);
        Assert.Empty(await LoadSubstitutionAuditsAsync(db));
    }

    [Theory]
    [InlineData(AuditFailureOperation.Create)]
    [InlineData(AuditFailureOperation.Update)]
    [InlineData(AuditFailureOperation.Cancel)]
    public async Task Legacy_mutation_routes_do_not_reach_audit_service(
        AuditFailureOperation operation)
    {
        await using var context = await CreateContextAsync(throwSubstitutionAudit: true);
        Guid? substitutionId = null;
        GroupTrainerSubstitution? original = null;
        if (operation is not AuditFailureOperation.Create)
        {
            substitutionId = await context.SeedSubstitutionAsync(
                BusinessDate.AddDays(1),
                BusinessDate.AddDays(3));
            original = (await context.LoadSubstitutionsAsync())[substitutionId.Value];
        }

        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        HttpResponseMessage response;
        if (operation == AuditFailureOperation.Create)
        {
            response = await PostJsonAsync(
                client,
                $"/groups/{context.Seeded.GroupId}/trainer-substitutions",
                new UpsertPayload(
                    context.Seeded.SubstituteTrainerId,
                    "2026-07-26",
                    "2026-07-28"),
                csrf);
        }
        else if (operation == AuditFailureOperation.Update)
        {
            response = await PutJsonAsync(
                client,
                $"/groups/{context.Seeded.GroupId}/trainer-substitutions/{substitutionId}",
                new UpsertPayload(
                    context.Seeded.SubstituteTrainerId,
                    "2026-07-26",
                    "2026-07-29"),
                csrf);
        }
        else
        {
            response = await PostWithoutBodyAsync(
                client,
                $"/groups/{context.Seeded.GroupId}/trainer-substitutions/{substitutionId}/cancel",
                csrf);
        }

        using (response)
        {
            AssertLegacyMutationRouteAbsent(response);
        }

        await using var db = context.CreateDbContext();
        var substitutions = await db.GroupTrainerSubstitutions.AsNoTracking().ToArrayAsync();
        if (operation == AuditFailureOperation.Create)
        {
            Assert.Empty(substitutions);
        }
        else
        {
            var stored = Assert.Single(substitutions);
            AssertSubstitutionState(original!, stored);
        }

        Assert.Empty(await LoadSubstitutionAuditsAsync(db));
    }

    private async Task<TestContext> CreateContextAsync(
        bool throwSubstitutionAudit = false)
    {
        await fixture.AcquireAsync();
        TestAppFactory? factory = null;
        try
        {
            await using (var migrationDb = CreateDbContext(fixture.ConnectionString))
            {
                await migrationDb.Database.EnsureDeletedAsync();
                await migrationDb.Database.MigrateAsync();
            }

            factory = new TestAppFactory(
                fixture.ConnectionString,
                throwSubstitutionAudit);
            var seeded = await SeedBaseDataAsync(factory);
            return new TestContext(
                fixture.ConnectionString,
                factory,
                seeded,
                fixture.Release);
        }
        catch
        {
            if (factory is not null)
            {
                await factory.DisposeAsync();
            }

            fixture.Release();
            throw;
        }
    }

    private static async Task<SeededData> SeedBaseDataAsync(TestAppFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var manager = CreateUser("task073-pg-manager", UserRole.HeadCoach, passwordHashService);
        var substitute = CreateUser("task073-pg-substitute", UserRole.Coach, passwordHashService);
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "TASK-073 PostgreSQL Branch",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "TASK-073 PostgreSQL Hall",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "TASK-073 PostgreSQL Type",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "TASK-073 PostgreSQL Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3, 5],
            IsActive = true,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };

        db.Users.AddRange(manager, substitute);
        db.Branches.Add(branch);
        db.Halls.Add(hall);
        db.GroupTypes.Add(groupType);
        db.TrainingGroups.Add(group);
        await db.SaveChangesAsync();

        return new SeededData(
            manager.Id,
            manager.Login,
            substitute.Id,
            group.Id);
    }

    private static User CreateUser(
        string login,
        UserRole role,
        IPasswordHashService passwordHashService)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Login = login,
            FullName = login,
            Role = role,
            IsActive = true,
            MustChangePassword = false,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        user.PasswordHash = passwordHashService.HashPassword(user, Password);
        return user;
    }

    private static GymCrmDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new GymCrmDbContext(options);
    }

    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        var result = await command.ExecuteScalarAsync();
        return (T)(result ?? throw new InvalidOperationException($"SQL returned null: {sql}"));
    }

    private static async Task<string> LoginAsync(HttpClient client, string login)
    {
        using var initial = await client.GetAsync("/auth/session");
        Assert.Equal(HttpStatusCode.OK, initial.StatusCode);
        var initialPayload = await initial.Content.ReadFromJsonAsync<JsonElement>();
        var initialCsrf = initialPayload.GetProperty("csrfToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(initialCsrf));

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new { login, password = Password },
            initialCsrf!);
        var body = await loginResponse.Content.ReadAsStringAsync();
        Assert.True(loginResponse.StatusCode == HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        var csrf = document.RootElement.GetProperty("csrfToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(csrf));
        return csrf!;
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<T>(
        HttpClient client,
        string path,
        T payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutJsonAsync<T>(
        HttpClient client,
        string path,
        T payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static void AssertLegacyMutationRouteAbsent(HttpResponseMessage response)
    {
        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected legacy mutation route absence (404/405), got {response.StatusCode}.");
    }

    private static async Task<AuditLog[]> LoadSubstitutionAuditsAsync(GymCrmDbContext db)
    {
        return await db.AuditLogs
            .AsNoTracking()
            .Where(audit => audit.EntityType == SubstitutionEntityType)
            .OrderBy(audit => audit.CreatedAt)
            .ThenBy(audit => audit.Id)
            .ToArrayAsync();
    }

    private static void AssertSubstitutionState(
        GroupTrainerSubstitution expected,
        GroupTrainerSubstitution actual)
    {
        Assert.Equal(expected.Id, actual.Id);
        Assert.Equal(expected.GroupId, actual.GroupId);
        Assert.Equal(expected.SubstituteTrainerId, actual.SubstituteTrainerId);
        Assert.Equal(expected.StartsOn, actual.StartsOn);
        Assert.Equal(expected.EndsOn, actual.EndsOn);
        Assert.Equal(expected.CreatedByUserId, actual.CreatedByUserId);
        Assert.Equal(expected.CreatedAt, actual.CreatedAt);
        Assert.Equal(expected.UpdatedAt, actual.UpdatedAt);
        Assert.Equal(expected.CancelledAt, actual.CancelledAt);
    }

    public enum AuditFailureOperation
    {
        Create,
        Update,
        Cancel
    }

    private sealed record UpsertPayload(
        Guid SubstituteTrainerId,
        string StartsOn,
        string EndsOn);

    private sealed record SeededData(
        Guid ManagerId,
        string ManagerLogin,
        Guid SubstituteTrainerId,
        Guid GroupId);

    private sealed class TestContext(
        string connectionString,
        TestAppFactory factory,
        SeededData seeded,
        Action release) : IAsyncDisposable
    {
        public string ConnectionString { get; } = connectionString;
        public SeededData Seeded { get; } = seeded;

        public HttpClient CreateClient()
        {
            return factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });
        }

        public GymCrmDbContext CreateDbContext()
        {
            return GroupTrainerSubstitutionPostgreSqlTests.CreateDbContext(ConnectionString);
        }

        public async Task<Guid> SeedSubstitutionAsync(DateOnly startsOn, DateOnly endsOn)
        {
            await using var db = CreateDbContext();
            var substitution = new GroupTrainerSubstitution
            {
                Id = Guid.NewGuid(),
                GroupId = Seeded.GroupId,
                SubstituteTrainerId = Seeded.SubstituteTrainerId,
                StartsOn = startsOn,
                EndsOn = endsOn,
                CreatedByUserId = Seeded.ManagerId,
                CreatedAt = SeededAt,
                UpdatedAt = SeededAt
            };
            db.GroupTrainerSubstitutions.Add(substitution);
            await db.SaveChangesAsync();
            return substitution.Id;
        }

        public async Task<Dictionary<Guid, GroupTrainerSubstitution>> LoadSubstitutionsAsync()
        {
            await using var db = CreateDbContext();
            return await db.GroupTrainerSubstitutions
                .AsNoTracking()
                .ToDictionaryAsync(substitution => substitution.Id);
        }

        public async ValueTask DisposeAsync()
        {
            await factory.DisposeAsync();
            release();
        }
    }

    private sealed class TestAppFactory(
        string connectionString,
        bool throwSubstitutionAudit) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = connectionString,
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "task073-pg-bootstrap",
                    ["BootstrapUser:FullName"] = "TASK-073 PostgreSQL Bootstrap"
                }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                services.AddDbContext<GymCrmDbContext>(options =>
                {
                    options.UseNpgsql(connectionString);
                });
                services.RemoveAll<IBusinessDateProvider>();
                services.AddSingleton<IBusinessDateProvider>(
                    new FixedBusinessDateProvider(BusinessDate));
                if (throwSubstitutionAudit)
                {
                    services.RemoveAll<IAuditLogService>();
                    services.AddScoped<IAuditLogService, ThrowingSubstitutionAuditLogService>();
                }
            });
        }
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }

    private sealed class ThrowingSubstitutionAuditLogService(
        GymCrmDbContext db) : IAuditLogService
    {
        public async Task WriteAsync(
            AuditLogEntry entry,
            CancellationToken cancellationToken = default)
        {
            if (entry.EntityType == SubstitutionEntityType)
            {
                throw new InvalidOperationException(
                    "Mandatory substitution audit failed for TASK-073 PostgreSQL regression test.");
            }

            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = entry.UserId,
                ActionType = entry.ActionType,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                Description = entry.Description,
                Source = entry.Source,
                MessengerPlatform = entry.MessengerPlatform,
                MessengerPlatformUserIdHash = entry.MessengerPlatformUserIdHash,
                OldValueJson = entry.OldValueJson,
                NewValueJson = entry.NewValueJson,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public sealed class PostgreSqlFixture : IAsyncLifetime
    {
        private readonly SemaphoreSlim gate = new(1, 1);
        private PostgreSqlContainer postgreSql = null!;

        public string ConnectionString => postgreSql.GetConnectionString();

        public async Task InitializeAsync()
        {
            postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
                .WithDatabase($"gym_crm_task073_{Guid.NewGuid():N}")
                .WithUsername("gym_crm")
                .WithPassword("gym_crm")
                .Build();
            await postgreSql.StartAsync();
        }

        public async Task DisposeAsync()
        {
            gate.Dispose();
            await postgreSql.DisposeAsync();
        }

        public Task AcquireAsync() => gate.WaitAsync();

        public void Release() => gate.Release();
    }
}
