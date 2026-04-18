using System.Net;
using System.Net.Http.Json;
using Crm.Application.Security;
using Crm.Domain.Groups;
using Crm.Domain.Users;
using Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Crm.Tests;

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
        Assert.Equal(
            ["Home", "Attendance", "Clients", "Groups", "Users", "Audit"],
            session.User.AllowedSections);
        Assert.True(session.User.Permissions.CanManageUsers);
        Assert.True(session.User.Permissions.CanManageClients);
        Assert.True(session.User.Permissions.CanManageGroups);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.True(session.User.Permissions.CanViewAuditLog);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/client-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(
            PostWithoutBodyAsync(client, $"/access/attendance/{seeded.ForeignGroupId}", session.CsrfToken),
            HttpStatusCode.OK);
    }

    [Fact]
    public async Task Administrator_cannot_manage_users_or_mark_attendance()
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
        Assert.Equal(["Home", "Clients", "Groups", "Audit"], session.User.AllowedSections);
        Assert.False(session.User.Permissions.CanManageUsers);
        Assert.True(session.User.Permissions.CanManageClients);
        Assert.True(session.User.Permissions.CanManageGroups);
        Assert.False(session.User.Permissions.CanMarkAttendance);
        Assert.True(session.User.Permissions.CanViewAuditLog);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/client-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.OK);
        await AssertStatusCodeAsync(
            PostWithoutBodyAsync(client, $"/access/attendance/{seeded.AssignedCoachGroupId}", session.CsrfToken),
            HttpStatusCode.Forbidden);
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
        Assert.Equal(["Attendance", "Clients"], session.User.AllowedSections);
        Assert.False(session.User.Permissions.CanManageUsers);
        Assert.False(session.User.Permissions.CanManageClients);
        Assert.False(session.User.Permissions.CanManageGroups);
        Assert.True(session.User.Permissions.CanMarkAttendance);
        Assert.False(session.User.Permissions.CanViewAuditLog);
        Assert.Equal([seeded.AssignedCoachGroupId.ToString()], session.User.AssignedGroupIds);

        await AssertStatusCodeAsync(client.GetAsync("/access/user-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/group-management"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(client.GetAsync("/access/audit-log"), HttpStatusCode.Forbidden);
        await AssertStatusCodeAsync(
            PostWithoutBodyAsync(client, $"/access/attendance/{seeded.AssignedCoachGroupId}", session.CsrfToken),
            HttpStatusCode.OK);
        await AssertStatusCodeAsync(
            PostWithoutBodyAsync(client, $"/access/attendance/{seeded.ForeignGroupId}", session.CsrfToken),
            HttpStatusCode.Forbidden);
    }

    private static async Task<SeededAuthorizationData> SeedAuthorizationDataAsync(AuthorizationAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage3-password";

        var headCoach = CreateUser("headcoach-stage3", "Главный тренер Stage 3", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage3", "Администратор Stage 3", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage3", "Тренер Stage 3", UserRole.Coach, sharedPassword, now, passwordHashService);

        var assignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group A",
            ScheduleText = "Mon/Wed/Fri",
            TrainingStartTime = new TimeOnly(18, 0),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var foreignGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group B",
            ScheduleText = "Tue/Thu",
            TrainingStartTime = new TimeOnly(19, 0),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.TrainingGroups.AddRange(assignedGroup, foreignGroup);
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = assignedGroup.Id,
            TrainerId = coach.Id
        });

        await dbContext.SaveChangesAsync();

        return new SeededAuthorizationData(
            headCoach.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
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
        string[] AssignedGroupIds);

    private sealed record PermissionPayload(
        bool CanManageUsers,
        bool CanManageClients,
        bool CanManageGroups,
        bool CanMarkAttendance,
        bool CanViewAuditLog);

    private sealed record SeededAuthorizationData(
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
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
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=crm;Username=crm;Password=crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage3",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 3"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<CrmDbContext>>();
                services.RemoveAll<CrmDbContext>();

                var databaseName = $"crm-authorization-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<CrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }
    }
}
