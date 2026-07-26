using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Clients;
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

public sealed class AdministratorAttendanceGrantPostgreSqlTests
{
    [Fact]
    public async Task Task080_PostgreSql_administrator_attendance_grant_enforces_composite_primary_key()
    {
        await using var context = await AdministratorAttendanceGrantPostgreSqlContext.CreateAsync();

        using var scope = context.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        dbContext.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
        {
            AdministratorId = context.SeededData.AdministratorId,
            GroupId = context.SeededData.PrimaryGroupId,
            BranchId = context.SeededData.AssignedBranchId,
            GrantedByUserId = context.SeededData.HeadCoachId,
            GrantedAt = DateTimeOffset.UtcNow
        });
        await Assert.ThrowsAsync<DbUpdateException>(async () => await dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task Task080_PostgreSql_administrator_attendance_grant_put_divergent_managers_resists_lost_update()
    {
        await using var context = await AdministratorAttendanceGrantPostgreSqlContext.CreateAsync();
        var seeded = context.SeededData;
        using var headCoachClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var superAdminClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var headCoachSession = await LoginAsync(headCoachClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var superAdminSession = await LoginAsync(superAdminClient, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        var endpoint = $"/settings/administrators/{seeded.AdministratorId}/attendance-groups";

        var managerOneTask = PutAttendanceGrantScopeAsync(
            headCoachClient,
            endpoint,
            new[]
            {
                seeded.PrimaryGroupId,
                seeded.AlternateGroupId
            },
            new[] { seeded.PrimaryGroupId },
            headCoachSession);
        var managerTwoTask = PutAttendanceGrantScopeAsync(
            superAdminClient,
            endpoint,
            Array.Empty<Guid>(),
            new[] { seeded.PrimaryGroupId },
            superAdminSession);

        var managerOneStatus = await managerOneTask;
        var managerTwoStatus = await managerTwoTask;
        var results = new[] { managerOneStatus, managerTwoStatus };

        Assert.Contains(HttpStatusCode.OK, results);
        Assert.Contains(HttpStatusCode.Conflict, results);

        using var scope = context.Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var grantedGroups = await dbContext.AdministratorAttendanceGroupGrants
            .AsNoTracking()
            .Where(grant => grant.AdministratorId == seeded.AdministratorId)
            .Select(grant => grant.GroupId)
            .OrderBy(groupId => groupId)
            .ToArrayAsync();

        var expectedGroups = managerOneStatus == HttpStatusCode.OK
            ? new[] { seeded.PrimaryGroupId, seeded.AlternateGroupId }.OrderBy(groupId => groupId).ToArray()
            : Array.Empty<Guid>();
        Assert.Equal(expectedGroups, grantedGroups);
    }

    [Fact]
    public async Task Task080_PostgreSql_admin_attendance_save_forbidden_after_committed_revoke()
    {
        await using var context = await AdministratorAttendanceGrantPostgreSqlContext.CreateAsync();
        var seeded = context.SeededData;

        using var managerClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var administratorClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var administratorSession = await LoginAsync(administratorClient, seeded.AdministratorLogin, seeded.SharedPassword);
        var endpoint = $"/settings/administrators/{seeded.AdministratorId}/attendance-groups";
        var groupDate = GetBusinessToday().ToString("yyyy-MM-dd");
        var attendancePayload = new
        {
            TrainingDate = groupDate,
            AttendanceMarks = new[] { new { ClientId = seeded.AttendanceClientId, State = "Absent" } }
        };

        using (var preSaveCheck = await administratorClient.GetAsync($"/attendance/groups/{seeded.PrimaryGroupId}/clients?trainingDate={groupDate}"))
        {
            Assert.Equal(HttpStatusCode.OK, preSaveCheck.StatusCode);
        }

        using (var preSaveCountScope = context.Factory.Services.CreateScope())
        {
            var db = preSaveCountScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Empty(await db.Attendance.Where(entry => entry.ClientId == seeded.AttendanceClientId).ToArrayAsync());
        }

        using (var revokeResponse = await PutJsonAsync(
                   managerClient,
                   endpoint,
                   new
                   {
                       GroupIds = Array.Empty<Guid>(),
                       ExpectedGroupIds = new[] { seeded.PrimaryGroupId }
                   },
                   managerSession))
        {
            Assert.Equal(HttpStatusCode.OK, revokeResponse.StatusCode);
        }

        using var forbiddenSaveResponse = await PostJsonAsync(
            administratorClient,
            $"/attendance/groups/{seeded.PrimaryGroupId}",
            attendancePayload,
            administratorSession);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenSaveResponse.StatusCode);

        using var postRevokeScope = context.Factory.Services.CreateScope();
        var postRevokeDb = postRevokeScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await postRevokeDb.Attendance.Where(entry => entry.ClientId == seeded.AttendanceClientId).ToArrayAsync());
    }

    [Fact]
    public async Task Task080_PostgreSql_branch_archive_endpoint_ordering_blocks_admin_attendance_save_until_restored()
    {
        await using var context = await AdministratorAttendanceGrantPostgreSqlContext.CreateAsync();
        var seeded = context.SeededData;
        using var managerClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var administratorClient = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var administratorSession = await LoginAsync(administratorClient, seeded.AdministratorLogin, seeded.SharedPassword);
        var groupDate = GetBusinessToday();
        var groupDateString = groupDate.ToString("yyyy-MM-dd");
        var attendancePayload = new
        {
            TrainingDate = groupDateString,
            AttendanceMarks = new[] { new { ClientId = seeded.AttendanceClientId, State = "Absent" } }
        };
        var attendancePayloadAfterRestore = new
        {
            TrainingDate = groupDateString,
            AttendanceMarks = new[] { new { ClientId = seeded.AttendanceClientId, State = "Present" } }
        };

        using (var baselineSave = await PostJsonAsync(
                   administratorClient,
                   $"/attendance/groups/{seeded.PrimaryGroupId}",
                   attendancePayload,
                   administratorSession))
        {
            Assert.Equal(HttpStatusCode.OK, baselineSave.StatusCode);
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   managerClient,
                   $"/branches/{seeded.AssignedBranchId}/archive",
                   managerSession))
        {
            Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        }

        using var archivedSave = await PostJsonAsync(
            administratorClient,
            $"/attendance/groups/{seeded.PrimaryGroupId}",
            attendancePayloadAfterRestore,
            administratorSession);
        Assert.Equal(HttpStatusCode.Forbidden, archivedSave.StatusCode);

        using (var restoreResponse = await PutWithoutBodyAsync(
                   managerClient,
                   $"/branches/{seeded.AssignedBranchId}/restore",
                   managerSession))
        {
            Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
        }

        using (var restoredSave = await PostJsonAsync(
                    administratorClient,
                    $"/attendance/groups/{seeded.PrimaryGroupId}",
                    attendancePayloadAfterRestore,
                    administratorSession))
        {
            Assert.Equal(HttpStatusCode.OK, restoredSave.StatusCode);
        }
    }

    [Fact]
    public async Task Task091_PostgreSql_administrator_update_rechecks_endpoint_family_after_locked_reload()
    {
        await using var context = await AdministratorAttendanceGrantPostgreSqlContext.CreateAsync();
        var seeded = context.SeededData;
        var connectionString = context.PostgreSql.GetConnectionString();
        using var client = context.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        await using var branchLockConnection = new NpgsqlConnection(connectionString);
        await branchLockConnection.OpenAsync();
        await using var branchLockTransaction = await branchLockConnection.BeginTransactionAsync();
        await using (var branchLockCommand = new NpgsqlCommand(
            """SELECT 1 FROM "Branches" WHERE "Id" = @branchId FOR UPDATE""",
            branchLockConnection,
            branchLockTransaction))
        {
            branchLockCommand.Parameters.AddWithValue("branchId", seeded.AssignedBranchId);
            await branchLockCommand.ExecuteScalarAsync();
        }

        var updateTask = PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}",
            new
            {
                FullName = "TASK-091 stale administrative request",
                Login = seeded.AdministratorLogin,
                Role = "Administrator",
                MustChangePassword = false,
                IsActive = true,
                BranchId = seeded.AssignedBranchId
            },
            session);

        await WaitForBlockedBranchLockAsync(connectionString);

        await using (var roleChangeConnection = new NpgsqlConnection(connectionString))
        {
            await roleChangeConnection.OpenAsync();
            await using var roleChangeCommand = new NpgsqlCommand(
                """UPDATE "Users" SET "Role" = 'Coach', "BranchId" = NULL WHERE "Id" = @userId""",
                roleChangeConnection);
            roleChangeCommand.Parameters.AddWithValue("userId", seeded.AdministratorId);
            Assert.Equal(1, await roleChangeCommand.ExecuteNonQueryAsync());
        }

        await branchLockTransaction.CommitAsync();

        using var response = await updateTask;
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.Equal("staff_not_found", problem.GetProperty("code").GetString());

        using var verificationScope = context.Factory.Services.CreateScope();
        var dbContext = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var reloadedTarget = await dbContext.Users
            .AsNoTracking()
            .SingleAsync(user => user.Id == seeded.AdministratorId);
        Assert.Equal(UserRole.Coach, reloadedTarget.Role);
        Assert.NotEqual("TASK-091 stale administrative request", reloadedTarget.FullName);
        Assert.False(await dbContext.AuditLogs.AnyAsync(log =>
            log.EntityType == "User" &&
            log.EntityId == seeded.AdministratorId.ToString() &&
            log.ActionType == "UserUpdated"));
    }

    private static async Task<HttpStatusCode> PutAttendanceGrantScopeAsync(
        HttpClient client,
        string endpoint,
        Guid[] requestedGroupIds,
        Guid[] expectedGroupIds,
        string csrfToken)
    {
        using var response = await PutJsonAsync(
            client,
            endpoint,
            new
            {
                GroupIds = requestedGroupIds,
                ExpectedGroupIds = expectedGroupIds
            },
            csrfToken);
        return response.StatusCode;
    }

    private static async Task<HttpResponseMessage> PutJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
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

    private static async Task<string> LoginAsync(HttpClient client, string login, string password)
    {
        using var initialSession = await client.GetAsync("/auth/session");
        Assert.Equal(HttpStatusCode.OK, initialSession.StatusCode);
        using var initialSessionPayload = JsonDocument.Parse(await initialSession.Content.ReadAsStringAsync());
        var csrfToken = initialSessionPayload.RootElement.GetProperty("csrfToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(csrfToken));

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            csrfToken);
        var loginBody = await loginResponse.Content.ReadAsStringAsync();
        Assert.True(
            loginResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {loginResponse.StatusCode}. Body: {loginBody}");

        using var loginPayload = JsonDocument.Parse(loginBody);
        var newCsrf = loginPayload.RootElement.GetProperty("csrfToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(newCsrf));
        return newCsrf!;
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task WaitForBlockedBranchLockAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        var deadline = DateTimeOffset.UtcNow.AddSeconds(10);

        while (DateTimeOffset.UtcNow < deadline)
        {
            await using var command = new NpgsqlCommand(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_stat_activity
                    WHERE pid <> pg_backend_pid()
                      AND wait_event_type = 'Lock'
                      AND query LIKE '%FROM "Branches"%'
                      AND query LIKE '%FOR UPDATE%'
                )
                """,
                connection);

            if (await command.ExecuteScalarAsync() is true)
            {
                return;
            }

            await Task.Delay(25);
        }

        throw new TimeoutException("The staff update did not reach the blocked branch lock.");
    }

    private static DateOnly GetBusinessToday()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
    }

    private static async Task<Guid> GetHeadCoachIdViaDatabase(
        IServiceProvider services,
        string login)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        return await dbContext.Users.Where(user => user.Login == login).Select(user => user.Id).SingleAsync();
    }

    private sealed record SeededAdministratorAttendanceGrantPostgreSqlData(
        Guid HeadCoachId,
        Guid SuperAdministratorId,
        Guid AdministratorId,
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string AdministratorLogin,
        string SharedPassword,
        Guid AssignedBranchId,
        Guid PrimaryGroupId,
        Guid AlternateGroupId,
        Guid ForeignBranchStoredGroupId,
        Guid AttendanceClientId);

    private sealed record LoginRequest(string Login, string Password);

    private sealed class AdministratorAttendanceGrantPostgreSqlContext : IAsyncDisposable
    {
        private AdministratorAttendanceGrantPostgreSqlContext(
            AdministratorAttendanceGrantPostgreSqlAppFactory factory,
            PostgreSqlContainer postgreSql,
            SeededAdministratorAttendanceGrantPostgreSqlData seededData)
        {
            Factory = factory;
            PostgreSql = postgreSql;
            SeededData = seededData;
        }

        public AdministratorAttendanceGrantPostgreSqlAppFactory Factory { get; }
        public PostgreSqlContainer PostgreSql { get; }
        public SeededAdministratorAttendanceGrantPostgreSqlData SeededData { get; }

        public static async Task<AdministratorAttendanceGrantPostgreSqlContext> CreateAsync()
        {
            var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
                .WithDatabase($"gym_crm_task080_attendance_grant_postgres_{Guid.NewGuid():N}")
                .WithUsername("gym_crm")
                .WithPassword("gym_crm")
                .Build();

            await postgreSql.StartAsync();
            var factory = new AdministratorAttendanceGrantPostgreSqlAppFactory(postgreSql.GetConnectionString());
            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

            try
            {
                await dbContext.Database.MigrateAsync();
                var seededData = await SeedDataAsync(factory);
                return new AdministratorAttendanceGrantPostgreSqlContext(factory, postgreSql, seededData);
            }
            catch
            {
                await factory.DisposeAsync();
                await postgreSql.DisposeAsync();
                throw;
            }
        }

        public ValueTask DisposeAsync()
        {
            return new ValueTask(DisposeAsyncCore());
        }

        private async Task DisposeAsyncCore()
        {
            await Factory.DisposeAsync();
            await PostgreSql.DisposeAsync();
        }

        private static async Task<SeededAdministratorAttendanceGrantPostgreSqlData> SeedDataAsync(
            AdministratorAttendanceGrantPostgreSqlAppFactory factory)
        {
            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

            var now = DateTimeOffset.UtcNow;
            var sharedPassword = "task080-postgres-password";

            var headCoach = CreateUser("headcoach-task080-postgres", "Главный тренер Task080 Postgres", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
            var superAdministrator = CreateUser(
                "superadministrator-task080-postgres",
                "Суперадминистратор Task080 Postgres",
                UserRole.SuperAdministrator,
                sharedPassword,
                now,
                passwordHashService);
            var administrator = CreateUser(
                "administrator-task080-postgres",
                "Администратор Task080 Postgres",
                UserRole.Administrator,
                sharedPassword,
                now,
                passwordHashService);

            var branch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Task080 Postgres Branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var secondBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Task080 Postgres Branch II",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            administrator.BranchId = branch.Id;

            var hall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                Name = "Task080 Postgres Hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var hallSecondBranch = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = secondBranch.Id,
                Name = "Task080 Postgres Hall II",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var groupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "Task080 Postgres Type",
                CreatedAt = now,
                UpdatedAt = now
            };
            var primaryGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                HallId = hall.Id,
                GroupTypeId = groupType.Id,
                Name = "Task080 Postgres Primary",
                TrainingStartTime = new TimeOnly(8, 0),
                DurationMinutes = 60,
                Weekdays = [1, 3],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var alternateGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                HallId = hall.Id,
                GroupTypeId = groupType.Id,
                Name = "Task080 Postgres Alternate",
                TrainingStartTime = new TimeOnly(9, 0),
                DurationMinutes = 60,
                Weekdays = [2, 4],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignBranchStoredGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = secondBranch.Id,
                HallId = hallSecondBranch.Id,
                GroupTypeId = groupType.Id,
                Name = "Task080 Postgres Foreign Stored",
                TrainingStartTime = new TimeOnly(10, 0),
                DurationMinutes = 45,
                Weekdays = [5, 6],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            var client = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                FirstName = "Task080",
                LastName = "Postgres",
                Phone = "+79990000001",
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Users.AddRange(headCoach, superAdministrator, administrator);
            dbContext.Branches.AddRange(branch, secondBranch);
            dbContext.Halls.AddRange(hall, hallSecondBranch);
            dbContext.GroupTypes.Add(groupType);
            dbContext.TrainingGroups.AddRange(primaryGroup, alternateGroup, foreignBranchStoredGroup);
            dbContext.Clients.Add(client);
            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = client.Id,
                GroupId = primaryGroup.Id,
                BranchId = branch.Id
            });

            dbContext.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
            {
                AdministratorId = administrator.Id,
                GroupId = primaryGroup.Id,
                BranchId = branch.Id,
                GrantedByUserId = headCoach.Id,
                GrantedAt = now
            });
            await dbContext.SaveChangesAsync();

            return new SeededAdministratorAttendanceGrantPostgreSqlData(
                headCoach.Id,
                superAdministrator.Id,
                administrator.Id,
                headCoach.Login,
                superAdministrator.Login,
                administrator.Login,
                sharedPassword,
                branch.Id,
                primaryGroup.Id,
                alternateGroup.Id,
                foreignBranchStoredGroup.Id,
                client.Id);
        }

        private static User CreateUser(
            string login,
            string fullName,
            UserRole role,
            string password,
            DateTimeOffset now,
            IPasswordHashService passwordHashService)
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Login = login,
                FullName = fullName,
                Role = role,
                IsActive = true,
                MustChangePassword = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            user.PasswordHash = passwordHashService.HashPassword(user, password);
            return user;
        }
    }

    private sealed class AdministratorAttendanceGrantPostgreSqlAppFactory(string connectionString) : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-task080-postgres",
                    ["BootstrapUser:FullName"] = "Bootstrap Task 080 Postgres"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                services.AddDbContext<GymCrmDbContext>(options => options.UseNpgsql(connectionString));
            });
        }
    }
}
