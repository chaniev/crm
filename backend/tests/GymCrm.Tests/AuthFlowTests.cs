using System.Net;
using System.Net.Http.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class AuthFlowTests
{
    [Fact]
    public async Task Login_sets_http_only_cookie_and_returns_forced_password_change_session()
    {
        await using var factory = new AuthAppFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var initialSession = await GetSessionAsync(client);

        Assert.False(initialSession.IsAuthenticated);
        Assert.NotEmpty(initialSession.CsrfToken);
        Assert.Null(initialSession.User);
        Assert.True(initialSession.BootstrapMode);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest("headcoach", "12345678"),
            initialSession.CsrfToken);

        var payload = await ReadJsonAsync<SessionPayload>(loginResponse);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.True(payload.IsAuthenticated);
        Assert.True(payload.BootstrapMode);
        Assert.NotNull(payload.User);
        Assert.True(payload.User.MustChangePassword);
        Assert.Equal("HeadCoach", payload.User.Role);
        Assert.True(loginResponse.Headers.TryGetValues("Set-Cookie", out var setCookies));
        Assert.Contains(
            setCookies,
            header => header.Contains("gym-crm.auth=", StringComparison.Ordinal) &&
                header.Contains("httponly", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Protected_api_stays_blocked_until_password_change_then_audit_contains_auth_events()
    {
        await using var factory = new AuthAppFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var initialSession = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest("headcoach", "12345678"),
            initialSession.CsrfToken);
        var loggedInSession = await ReadJsonAsync<SessionPayload>(loginResponse);

        using var blockedProfileResponse = await client.GetAsync("/auth/profile");
        Assert.Equal(HttpStatusCode.Forbidden, blockedProfileResponse.StatusCode);

        using var changePasswordResponse = await PostJsonAsync(
            client,
            "/auth/change-password",
            new ChangePasswordRequest("12345678", "gym-crm-stage-2-password"),
            loggedInSession.CsrfToken);
        var changedSession = await ReadJsonAsync<SessionPayload>(changePasswordResponse);

        Assert.Equal(HttpStatusCode.OK, changePasswordResponse.StatusCode);
        Assert.True(changedSession.IsAuthenticated);
        Assert.False(changedSession.BootstrapMode);
        Assert.NotNull(changedSession.User);
        Assert.False(changedSession.User.MustChangePassword);

        using var profileResponse = await client.GetAsync("/auth/profile");
        var profile = await ReadJsonAsync<UserPayload>(profileResponse);

        Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
        Assert.Equal("HeadCoach", profile.Role);

        using var logoutResponse = await PostWithoutBodyAsync(
            client,
            "/auth/logout",
            changedSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var auditEntries = await dbContext.AuditLogs
            .OrderBy(entry => entry.CreatedAt)
            .Select(entry => new
            {
                entry.ActionType,
                entry.Description
            })
            .ToListAsync();

        Assert.Equal(["Login", "PasswordChanged", "Logout"], auditEntries.Select(entry => entry.ActionType));
        Assert.Equal(
            [
                "Пользователь 'headcoach' вошёл в систему.",
                "Пользователь 'headcoach' изменил пароль.",
                "Пользователь 'headcoach' вышел из системы."
            ],
            auditEntries.Select(entry => entry.Description));
    }

    [Fact]
    public async Task Change_password_without_csrf_token_is_rejected()
    {
        await using var factory = new AuthAppFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var initialSession = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest("headcoach", "12345678"),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/change-password")
        {
            Content = JsonContent.Create(new ChangePasswordRequest("12345678", "another-password"))
        };

        using var changePasswordResponse = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, changePasswordResponse.StatusCode);
    }

    [Theory]
    [InlineData("MiXeD.Coach-01")]
    [InlineData("mixed.coach-01")]
    [InlineData("MIXED.COACH-01")]
    [InlineData("  MiXeD.cOaCh-01  ")]
    public async Task Login_accepts_case_variants_of_stored_login_and_returns_canonical_identity(string inputLogin)
    {
        const string storedLogin = "MiXeD.Coach-01";
        const string password = "coach-password-01";
        await using var factory = new AuthAppFactory();
        var seededUserId = await SeedActiveCoachAsync(factory, storedLogin, password, isActive: true);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var initialSession = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(inputLogin, password),
            initialSession.CsrfToken);

        var payload = await ReadJsonAsync<SessionPayload>(loginResponse);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.True(payload.IsAuthenticated);
        Assert.NotNull(payload.User);
        Assert.Equal(seededUserId.ToString(), payload.User.Id);
        Assert.Equal(storedLogin, payload.User.Login);

        using var profileResponse = await client.GetAsync("/auth/profile");
        var profile = await ReadJsonAsync<UserPayload>(profileResponse);

        Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
        Assert.Equal(seededUserId.ToString(), profile.Id);
        Assert.Equal(storedLogin, profile.Login);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var loginAudit = await dbContext.AuditLogs.SingleAsync(
                entry => entry.ActionType == "Login" && entry.UserId == seededUserId);
            Assert.Equal($"Пользователь '{storedLogin}' вошёл в систему.", loginAudit.Description);
        }
    }

    [Theory]
    [InlineData("mixed.coach-01", "wrong-password")]
    [InlineData("MIXED.COACH-01", "wrong-password")]
    [InlineData("unknown-login", "coach-password-01")]
    [InlineData("UNKNOWN-LOGIN", "coach-password-01")]
    [InlineData("INACTIVE.COACH-01", "inactive-password-01")]
    public async Task Login_failure_keeps_non_enumerating_contract_for_case_variants(string inputLogin, string password)
    {
        await using var factory = new AuthAppFactory();
        await SeedActiveCoachAsync(factory, "MiXeD.Coach-01", "coach-password-01", isActive: true);
        await SeedActiveCoachAsync(factory, "Inactive.Coach-01", "inactive-password-01", isActive: false);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var initialSession = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(inputLogin, password),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.Unauthorized, loginResponse.StatusCode);
        var problem = await ReadJsonAsync<ProblemPayload>(loginResponse);
        Assert.Equal("InvalidCredentials", problem.Title);
        Assert.Equal("Неверный логин или пароль.", problem.Detail);
        var rawBody = await loginResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("MiXeD.Coach-01", rawBody, StringComparison.Ordinal);
        Assert.DoesNotContain("mixed.coach-01", rawBody, StringComparison.Ordinal);
        Assert.DoesNotContain("Inactive.Coach-01", rawBody, StringComparison.Ordinal);
    }

    private static async Task<Guid> SeedActiveCoachAsync(
        AuthAppFactory factory,
        string login,
        string password,
        bool isActive)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = $"Тренер {login}",
            Login = login,
            Role = UserRole.Coach,
            MustChangePassword = false,
            IsActive = isActive,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = passwordHashService.HashPassword(user, password);
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return user.Id;
    }

    private static async Task<SessionPayload> GetSessionAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/auth/session");
        return await ReadJsonAsync<SessionPayload>(response);
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

    private sealed record ProblemPayload(string Title, string Detail);

    private sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    private sealed record SessionPayload(
        bool IsAuthenticated,
        string CsrfToken,
        UserPayload? User,
        bool BootstrapMode);

    private sealed record UserPayload(
        string Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen);

    private sealed class AuthAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "headcoach",
                    ["BootstrapUser:FullName"] = "Главный тренер"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-auth-tests-{Guid.NewGuid():N}";
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
