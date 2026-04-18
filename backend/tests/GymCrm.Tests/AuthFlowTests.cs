using System.Net;
using System.Net.Http.Json;
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

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest("headcoach", "12345678"),
            initialSession.CsrfToken);

        var payload = await ReadJsonAsync<SessionPayload>(loginResponse);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.True(payload.IsAuthenticated);
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
        var auditActions = await dbContext.AuditLogs
            .OrderBy(entry => entry.CreatedAt)
            .Select(entry => entry.ActionType)
            .ToListAsync();

        Assert.Equal(["Login", "PasswordChanged", "Logout"], auditActions);
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

    private sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

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
