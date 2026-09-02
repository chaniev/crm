using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class CaseInsensitiveLoginPostgreSqlTests
{
    private const string PreviousMigration = "20260823173644_AddLessonOccurrenceTrainerSubstitutions";
    private const string NormalizedKeyColumnMigration = "20260901120000_AddNormalizedLoginKeyColumn";
    private const string CaseInsensitiveBarrierMigration = "20260901120001_RequireCaseInsensitiveLoginIdentity";
    private const string DuplicateLoginError = "Пользователь с таким логином уже существует.";

    [Fact]
    public async Task PostgreSql_barrier_allows_one_case_variant_and_maps_dupe_to_field_error_with_canonical_auth()
    {
        await using var postgreSql = await StartContainerAsync("login-identity-barrier");
        var connectionString = postgreSql.GetConnectionString();
        await using var factory = new LoginIdentityPostgreSqlAppFactory(connectionString);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorId = await SeedHeadCoachActorAsync(factory, "Task166-HeadCoach", "task166-actor-password");
        var session = await LoginAsync(client, "TASK166-HEADCOACH", "task166-actor-password");
        Assert.Equal(actorId.ToString(), session.User!.Id);

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/coaches",
                   new Dictionary<string, object?>
                   {
                       ["fullName"] = "Тренер Кэноник",
                       ["login"] = "Coach",
                       ["password"] = "task166-coach-password",
                       ["role"] = "Coach",
                       ["mustChangePassword"] = false,
                       ["isActive"] = true
                   },
                   session.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                await createResponse.Content.ReadAsStringAsync());
        }

        await AssertExactlyOneConcurrentCommitSurvivesAsync(connectionString);

        using var duplicateResponse = await PostJsonAsync(
            client,
            "/coaches",
            new Dictionary<string, object?>
            {
                ["fullName"] = "Дубль регистра",
                ["login"] = "COACH",
                ["password"] = "task166-coach-password",
                ["role"] = "Coach",
                ["mustChangePassword"] = false,
                ["isActive"] = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        var duplicateBody = await duplicateResponse.Content.ReadAsStringAsync();
        using (var document = JsonDocument.Parse(duplicateBody))
        {
            Assert.Equal(
                DuplicateLoginError,
                document.RootElement.GetProperty("errors").GetProperty("login")[0].GetString());
        }

        Assert.DoesNotContain("UX_Users_LoginNormalized", duplicateBody, StringComparison.Ordinal);
        Assert.DoesNotContain("PostgresException", duplicateBody, StringComparison.Ordinal);
        Assert.DoesNotContain("23505", duplicateBody, StringComparison.Ordinal);

        using (var loginResponse = await PostJsonAsync(
                   client,
                   "/auth/login",
                   new LoginRequest("COACH", "task166-coach-password"),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
            var coachSession = await ReadJsonAsync<SessionPayload>(loginResponse);
            Assert.NotNull(coachSession.User);
            Assert.Equal("Coach", coachSession.User.Login);
        }

        using (var profileResponse = await client.GetAsync("/auth/profile"))
        {
            Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
            var profile = await ReadJsonAsync<UserPayload>(profileResponse);
            Assert.Equal("Coach", profile.Login);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var coach = await dbContext.Users.SingleAsync(user => user.Login == "Coach");
            Assert.Equal("coach", coach.LoginNormalized);
            var loginAudit = await dbContext.AuditLogs.SingleAsync(entry =>
                entry.ActionType == "Login" && entry.UserId == coach.Id);
            Assert.Equal("Пользователь 'Coach' вошёл в систему.", loginAudit.Description);
        }
    }

    [Fact]
    public async Task PostgreSql_retained_upgrade_backfills_normalized_keys_and_replaces_unique_index()
    {
        await using var postgreSql = await StartContainerAsync("login-identity-upgrade");
        var connectionString = postgreSql.GetConnectionString();
        var options = CreateContextOptions(connectionString);

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
            await migrator.MigrateAsync(PreviousMigration);
        }

        await InsertLegacyUserAsync(connectionString, "Coach");
        await InsertLegacyUserAsync(connectionString, "Alice");

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
            await migrator.MigrateAsync(NormalizedKeyColumnMigration);
            await LoginIdentityBackfill.ReconcileAsync(dbContext);
            await migrator.MigrateAsync();
        }

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var users = await dbContext.Users.ToDictionaryAsync(user => user.Login);
            Assert.Equal(2, users.Count);
            Assert.All(users.Values, user =>
                Assert.Equal(LoginIdentity.NormalizeKey(user.Login), user.LoginNormalized));

            var coachByKey = await dbContext.Users.SingleAsync(
                user => user.LoginNormalized == LoginIdentity.NormalizeKey("COACH"));
            Assert.Equal("Coach", coachByKey.Login);
        }

        await AssertIndexPresentAsync(connectionString, "UX_Users_LoginNormalized");
        await AssertIndexAbsentAsync(connectionString, "IX_Users_Login");
        await AssertColumnNotNullAsync(connectionString);
    }

    [Fact]
    public async Task PostgreSql_retained_upgrade_with_case_collision_stops_without_touching_rows()
    {
        await using var postgreSql = await StartContainerAsync("login-identity-collision");
        var connectionString = postgreSql.GetConnectionString();
        var options = CreateContextOptions(connectionString);

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
            await migrator.MigrateAsync(PreviousMigration);
        }

        await InsertLegacyUserAsync(connectionString, "Coach");
        await InsertLegacyUserAsync(connectionString, "coach");

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
            await migrator.MigrateAsync(NormalizedKeyColumnMigration);

            var reconcileException = await Assert.ThrowsAsync<InvalidOperationException>(
                () => LoginIdentityBackfill.ReconcileAsync(dbContext));
            Assert.Contains("case-insensitive-login-collision", reconcileException.Message, StringComparison.Ordinal);
            Assert.Contains("Coach/coach", reconcileException.Message, StringComparison.Ordinal);

            var barrierException = await Assert.ThrowsAnyAsync<Exception>(() => migrator.MigrateAsync());
            Assert.Contains("case-insensitive-login-collision", barrierException.ToString(), StringComparison.Ordinal);
            Assert.Contains("no normalized login key", barrierException.ToString(), StringComparison.Ordinal);
        }

        await using (var dbContext = new GymCrmDbContext(options))
        {
            var retryException = await Assert.ThrowsAnyAsync<Exception>(() => dbContext.Database.MigrateAsync());
            Assert.Contains("case-insensitive-login-collision", retryException.ToString(), StringComparison.Ordinal);
        }

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using (var loginCommand = connection.CreateCommand())
        {
            loginCommand.CommandText = "SELECT \"Login\" FROM \"Users\" ORDER BY \"Login\"";
            var logins = new List<string>();
            await using var reader = await loginCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                logins.Add(reader.GetString(0));
            }

            Assert.Equal(["Coach", "coach"], logins);
        }

        await using (var keyCommand = connection.CreateCommand())
        {
            keyCommand.CommandText = """
                SELECT count(*) FROM "Users" WHERE "LoginNormalized" IS NOT NULL
                """;
            var backfilledCount = Convert.ToInt64(await keyCommand.ExecuteScalarAsync());
            Assert.Equal(0, backfilledCount);
        }

        await using (var historyCommand = connection.CreateCommand())
        {
            historyCommand.CommandText = """
                SELECT "MigrationId" FROM "__EFMigrationsHistory"
                WHERE "MigrationId" = ANY(@applied)
                """;
            historyCommand.Parameters.AddWithValue(
                "applied",
                new[] { NormalizedKeyColumnMigration, CaseInsensitiveBarrierMigration });
            var applied = new List<string>();
            await using var reader = await historyCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                applied.Add(reader.GetString(0));
            }

            Assert.Equal([NormalizedKeyColumnMigration], applied);
        }

        await AssertIndexPresentAsync(connectionString, "IX_Users_Login");
        await AssertIndexAbsentAsync(connectionString, "UX_Users_LoginNormalized");
    }

    private static async Task<PostgreSqlContainer> StartContainerAsync(string nameSuffix)
    {
        var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase($"gym_crm_{nameSuffix}_{Guid.NewGuid():N}")
            .WithUsername("gym_crm")
            .WithPassword("gym_crm")
            .Build();
        await postgreSql.StartAsync();

        return postgreSql;
    }

    private static DbContextOptions<GymCrmDbContext> CreateContextOptions(string connectionString)
    {
        return new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(connectionString)
            .Options;
    }

    private static async Task<Guid> SeedHeadCoachActorAsync(
        LoginIdentityPostgreSqlAppFactory factory,
        string login,
        string password)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "TASK-166 Главный тренер",
            Login = login,
            Role = UserRole.HeadCoach,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = passwordHashService.HashPassword(user, password);
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return user.Id;
    }

    private static async Task AssertExactlyOneConcurrentCommitSurvivesAsync(string connectionString)
    {
        var firstOptions = CreateContextOptions(connectionString);
        var secondOptions = CreateContextOptions(connectionString);
        await using var firstContext = new GymCrmDbContext(firstOptions);
        await using var secondContext = new GymCrmDbContext(secondOptions);
        firstContext.Users.Add(CreateDirectUser("assistant"));
        secondContext.Users.Add(CreateDirectUser("ASSISTANT"));

        var firstSave = Task.Run(() => firstContext.SaveChangesAsync());
        var secondSave = Task.Run(() => secondContext.SaveChangesAsync());
        var results = await Task.WhenAll(
            firstSave.ContinueWith(task => (attempt: 1, task), TaskScheduler.Default),
            secondSave.ContinueWith(task => (attempt: 2, task), TaskScheduler.Default));

        var succeeded = results.Where(result => result.task.IsCompletedSuccessfully).ToArray();
        var failed = results.Where(result => result.task.IsFaulted).ToArray();

        Assert.Single(succeeded);
        Assert.Single(failed);
        var failure = Assert.IsType<DbUpdateException>(failed[0].task.Exception!.GetBaseException());
        var postgresException = Assert.IsType<PostgresException>(failure.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, postgresException.SqlState);
        Assert.Equal("UX_Users_LoginNormalized", postgresException.ConstraintName);

        await using var verificationContext = new GymCrmDbContext(CreateContextOptions(connectionString));
        Assert.Equal(
            1,
            await verificationContext.Users.CountAsync(user => user.LoginNormalized == "assistant"));
    }

    private static User CreateDirectUser(string login)
    {
        var now = DateTimeOffset.UtcNow;
        return new User
        {
            Id = Guid.NewGuid(),
            FullName = $"Direct {login}",
            Login = login,
            PasswordHash = "direct-insert-hash",
            Role = UserRole.Coach,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static async Task InsertLegacyUserAsync(string connectionString, string login)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO "Users" (
                "Id", "FullName", "Login", "PasswordHash", "Role",
                "MustChangePassword", "IsActive", "CreatedAt", "UpdatedAt")
            VALUES (
                @id, @fullName, @login, 'legacy-password-hash', 'Coach',
                false, true, @timestamp, @timestamp)
            """;
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("fullName", $"Legacy {login}");
        command.Parameters.AddWithValue("login", login);
        command.Parameters.AddWithValue("timestamp", DateTimeOffset.UtcNow);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task AssertIndexPresentAsync(string connectionString, string indexName)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT count(*) FROM pg_indexes WHERE tablename = 'Users' AND indexname = @name";
        command.Parameters.AddWithValue("name", indexName);
        Assert.Equal(1, Convert.ToInt64(await command.ExecuteScalarAsync()));
    }

    private static async Task AssertIndexAbsentAsync(string connectionString, string indexName)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT count(*) FROM pg_indexes WHERE tablename = 'Users' AND indexname = @name";
        command.Parameters.AddWithValue("name", indexName);
        Assert.Equal(0, Convert.ToInt64(await command.ExecuteScalarAsync()));
    }

    private static async Task AssertColumnNotNullAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'Users' AND column_name = 'LoginNormalized'
            """;
        Assert.Equal("NO", (string?)await command.ExecuteScalarAsync());
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        using var sessionResponse = await client.GetAsync("/auth/session");
        var initialSession = await ReadJsonAsync<SessionPayload>(sessionResponse);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            initialSession.CsrfToken);
        Assert.True(
            loginResponse.StatusCode == HttpStatusCode.OK,
            await loginResponse.Content.ReadAsStringAsync());

        return await ReadJsonAsync<SessionPayload>(loginResponse);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(
        bool IsAuthenticated,
        string CsrfToken,
        UserPayload? User);

    private sealed record UserPayload(
        string Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive);

    private sealed class LoginIdentityPostgreSqlAppFactory(string connectionString)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = connectionString,
                    ["Persistence:ApplyMigrationsOnStartup"] = "true",
                    ["BootstrapUser:Login"] = "task166-pg-bootstrap",
                    ["BootstrapUser:FullName"] = "TASK-166 PG Bootstrap",
                    ["TechnicalLogging:DirectoryPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-task166-technical-{Guid.NewGuid():N}")
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options.UseNpgsql(connectionString));
            });
        }
    }
}
