using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class AuthorizationFlowTests
{
    [Fact]
    public async Task Head_coach_has_access_to_all_stage_3_capabilities()
    {
        await using var factory = new AuthorizationAppFactory();
        var seeded = await SeedAuthorizationDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        Assert.NotNull(session.User);
        Assert.Equal("HeadCoach", session.User.Role);
        Assert.Null(session.User.BranchId);
        Assert.Equal(
            ["Administrator", "Coach", "SuperAdministrator"],
            session.User.CreateRoleOptions);
        Assert.Equal("Home", session.User.LandingScreen);
        Assert.Equal(
            ["Home", "Schedule", "Clients", "Groups", "Users", "Audit", "Finance", "Settings"],
            session.User.AllowedSections);
        Assert.True(session.User.Permissions.CanManageUsers);
        Assert.True(session.User.Permissions.CanManageClients);
        Assert.True(session.User.Permissions.CanManageGroups);
        Assert.True(session.User.Permissions.CanManageSettings);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.True(session.User.Permissions.CanViewAuditLog);
        Assert.True(session.User.Permissions.CanViewFinancialReports);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/client-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/settings-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/financial-reports"), HttpStatusCode.OK);
        await AssertGroupAccessGrantedByAsync(
            client,
            seeded.ForeignGroupId,
            session.CsrfToken,
            "gym-crm.mark-attendance");
    }

    [Fact]
    public async Task Administrator_can_open_attendance_but_is_denied_groups_without_grants()
    {
        await using var factory = new AuthorizationAppFactory();
        var seeded = await SeedAuthorizationDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        Assert.NotNull(session.User);
        Assert.Equal("Administrator", session.User.Role);
        Assert.Equal(seeded.AssignedBranchId, session.User.BranchId);
        Assert.Empty(session.User.CreateRoleOptions);
        Assert.Equal("Home", session.User.LandingScreen);
        Assert.Equal(["Home", "Schedule", "Clients", "Groups", "Audit", "Settings"], session.User.AllowedSections);
        Assert.False(session.User.Permissions.CanManageUsers);
        Assert.True(session.User.Permissions.CanManageClients);
        Assert.True(session.User.Permissions.CanManageGroups);
        Assert.True(session.User.Permissions.CanManageSettings);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.True(session.User.Permissions.CanViewAuditLog);
        Assert.False(session.User.Permissions.CanViewFinancialReports);
        Assert.Empty(session.User.AssignedGroupIds);
        Assert.NotNull(session.User.AttendanceScope);
        Assert.Equal("AdministratorGrants", session.User.AttendanceScope.Kind);
        Assert.Empty(session.User.AttendanceScope.GroupIds);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/client-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/settings-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/financial-reports"), HttpStatusCode.Forbidden);
        await AssertAttendanceGroupForbiddenProblemAsync(
            await PostWithoutBodyAsync(client, $"/access/attendance/{seeded.AssignedCoachGroupId}", session.CsrfToken));
    }

    [Fact]
    public async Task Coach_can_mark_attendance_only_in_assigned_group()
    {
        await using var factory = new AuthorizationAppFactory();
        var seeded = await SeedAuthorizationDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);

        Assert.NotNull(session.User);
        Assert.Equal("Coach", session.User.Role);
        Assert.Null(session.User.BranchId);
        Assert.Empty(session.User.CreateRoleOptions);
        Assert.Equal("Home", session.User.LandingScreen);
        Assert.Equal(["Home", "Schedule", "Clients"], session.User.AllowedSections);
        Assert.False(session.User.Permissions.CanManageUsers);
        Assert.False(session.User.Permissions.CanManageClients);
        Assert.False(session.User.Permissions.CanManageGroups);
        Assert.False(session.User.Permissions.CanManageSettings);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.False(session.User.Permissions.CanViewAuditLog);
        Assert.False(session.User.Permissions.CanViewFinancialReports);
        Assert.Equal([seeded.AssignedCoachGroupId.ToString()], session.User.AssignedGroupIds);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/settings-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/financial-reports"), HttpStatusCode.Forbidden);
        await AssertGroupAccessGrantedByAsync(
            client,
            seeded.AssignedCoachGroupId,
            session.CsrfToken,
            "coach-group-assignment");
        await AssertAttendanceGroupForbiddenProblemAsync(
            await PostWithoutBodyAsync(client, $"/access/attendance/{seeded.ForeignGroupId}", session.CsrfToken));
    }

    [Fact]
    public async Task Super_administrator_session_is_global_without_branch_or_head_coach_only_finance()
    {
        await using var factory = new AuthorizationAppFactory();
        var seeded = await SeedAuthorizationDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);

        Assert.NotNull(session.User);
        Assert.Equal("SuperAdministrator", session.User.Role);
        Assert.Null(session.User.BranchId);
        Assert.Equal(["Administrator", "Coach"], session.User.CreateRoleOptions);
        Assert.Equal("Home", session.User.LandingScreen);
        Assert.Equal(
            ["Home", "Schedule", "Clients", "Groups", "Users", "Audit", "Settings"],
            session.User.AllowedSections);
        Assert.True(session.User.Permissions.CanManageUsers);
        Assert.True(session.User.Permissions.CanManageClients);
        Assert.True(session.User.Permissions.CanManageGroups);
        Assert.True(session.User.Permissions.CanManageSettings);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.True(session.User.Permissions.CanViewAuditLog);
        Assert.False(session.User.Permissions.CanViewFinancialReports);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/client-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/settings-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/financial-reports"), HttpStatusCode.Forbidden);
        await AssertGroupAccessGrantedByAsync(
            client,
            seeded.AssignedCoachGroupId,
            session.CsrfToken,
            "gym-crm.mark-attendance");
        await AssertGroupAccessGrantedByAsync(
            client,
            seeded.ForeignGroupId,
            session.CsrfToken,
            "gym-crm.mark-attendance");
    }

    private static async Task<SeededAuthorizationData> SeedAuthorizationDataAsync(AuthorizationAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage3-password";

        var headCoach = CreateUser("headcoach-stage3", "Главный тренер Stage 3", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var superAdministrator = CreateUser(
            "superadministrator-stage3",
            "Суперадминистратор Stage 3",
            UserRole.SuperAdministrator,
            sharedPassword,
            now,
            passwordHashService);
        var administrator = CreateUser("administrator-stage3", "Администратор Stage 3", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage3", "Тренер Stage 3", UserRole.Coach, sharedPassword, now, passwordHashService);

        var assignedBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Assigned Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Foreign Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var assignedHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            Name = "Assigned Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            Name = "Foreign Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Authorization Default Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var assignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            HallId = assignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Group A",
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            TrainingStartTime = new TimeOnly(18, 0),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var foreignGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            HallId = foreignHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Group B",
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            TrainingStartTime = new TimeOnly(19, 0),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = assignedBranch.Id;

        dbContext.Users.AddRange(headCoach, superAdministrator, administrator, coach);
        dbContext.Branches.AddRange(assignedBranch, foreignBranch);
        dbContext.Halls.AddRange(assignedHall, foreignHall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(assignedGroup, foreignGroup);
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = assignedGroup.Id,
            TrainerId = coach.Id
        });

        await dbContext.SaveChangesAsync();

        return new SeededAuthorizationData(
            headCoach.Login,
            superAdministrator.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            assignedBranch.Id,
            assignedGroup.Id,
            foreignGroup.Id);
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
            FullName = fullName,
            Login = login,
            Role = role,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);

        return user;
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        var initialSession = await GetSessionAsync(client);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return await ReadJsonAsync<SessionPayload>(loginResponse);
    }

    private static async Task<SessionPayload> GetSessionAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/auth/session");
        return await ReadJsonAsync<SessionPayload>(response);
    }

    private static async Task AssertStatusCodeAsync(Task<HttpResponseMessage> responseTask, HttpStatusCode expectedStatusCode)
    {
        using var response = await responseTask;
        Assert.Equal(expectedStatusCode, response.StatusCode);
    }

    private static async Task AssertGroupAccessGrantedByAsync(
        HttpClient client,
        Guid groupId,
        string csrfToken,
        string expectedGrantedBy)
    {
        using var response = await PostWithoutBodyAsync(client, $"/access/attendance/{groupId}", csrfToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonAsync<GroupAccessProbePayload>(response);
        Assert.Equal(groupId, payload.GroupId);
        Assert.Equal("Attendance", payload.Capability);
        Assert.Equal(expectedGrantedBy, payload.GrantedBy);
    }

    private static async Task AssertAttendanceGroupForbiddenProblemAsync(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("/problems/attendance-group-forbidden", payload.GetProperty("type").GetString());
            Assert.Equal("attendance_group_forbidden", payload.GetProperty("code").GetString());
        }
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

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record GroupAccessProbePayload(Guid GroupId, string Capability, string GrantedBy);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(
        string Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen,
        string[] AllowedSections,
        PermissionPayload Permissions,
        string[] AssignedGroupIds,
        AttendanceScopePayload? AttendanceScope,
        Guid? BranchId,
        string[] CreateRoleOptions);

    private sealed record AttendanceScopePayload(string Kind, string[] GroupIds);

    private sealed record PermissionPayload(
        bool CanManageUsers,
        bool CanManageClients,
        bool CanManageGroups,
        bool CanManageSettings,
        bool CanMarkAttendance,
        bool CanViewAuditLog,
        bool CanViewFinancialReports);

    private sealed record SeededAuthorizationData(
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid AssignedBranchId,
        Guid AssignedCoachGroupId,
        Guid ForeignGroupId);

    private sealed class AuthorizationAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage3",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 3"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-authorization-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }
    }
}
