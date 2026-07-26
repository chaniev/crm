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

public class AppConfigApiTests
{
    [Fact]
    public async Task Get_config_returns_default_club_name_without_explicit_branding_config()
    {
        await using var factory = new AppConfigAppFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/config");
        var payload = await ReadJsonAsync<AppConfigPayload>(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Gym CRM", payload.ClubName);
        Assert.Equal("default-green-v1", payload.ThemeId);
        Assert.Equal("k4pro-login-v1", payload.AuthBackgroundImageId);
    }

    [Fact]
    public async Task Get_config_returns_trimmed_custom_club_name()
    {
        await using var factory = new AppConfigAppFactory("  Iron Club  ");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/config");
        var payload = await ReadJsonAsync<AppConfigPayload>(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Iron Club", payload.ClubName);
        Assert.Equal("default-green-v1", payload.ThemeId);
        Assert.Equal("k4pro-login-v1", payload.AuthBackgroundImageId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Get_config_returns_defaults_for_empty_or_whitespace_branding_config(
        string configuredValue)
    {
        await using var factory = new AppConfigAppFactory(
            configuredValue,
            configuredValue,
            configuredValue);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/config");
        var payload = await ReadJsonAsync<AppConfigPayload>(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Gym CRM", payload.ClubName);
        Assert.Equal("default-green-v1", payload.ThemeId);
        Assert.Equal("k4pro-login-v1", payload.AuthBackgroundImageId);
    }

    [Fact]
    public async Task Get_config_returns_trimmed_opaque_branding_profile_ids()
    {
        await using var factory = new AppConfigAppFactory(
            clubName: "  Iron Club  ",
            themeId: "  custom-theme-v42  ",
            authBackgroundImageId: "  custom-login-bg-v9  ");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/config");
        var payload = await ReadJsonAsync<AppConfigPayload>(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Iron Club", payload.ClubName);
        Assert.Equal("custom-theme-v42", payload.ThemeId);
        Assert.Equal("custom-login-bg-v9", payload.AuthBackgroundImageId);
    }

    [Fact]
    public async Task Get_config_stays_available_while_authenticated_user_must_change_password()
    {
        await using var factory = new AppConfigAppFactory("Iron Club");
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest("headcoach", "12345678"),
            session.CsrfToken);
        var loggedInSession = await ReadJsonAsync<SessionPayload>(loginResponse);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        Assert.True(loggedInSession.User?.MustChangePassword);

        using var configResponse = await client.GetAsync("/config");
        var config = await ReadJsonAsync<AppConfigPayload>(configResponse);

        Assert.Equal(HttpStatusCode.OK, configResponse.StatusCode);
        Assert.Equal("Iron Club", config.ClubName);
        Assert.Equal("default-green-v1", config.ThemeId);
        Assert.Equal("k4pro-login-v1", config.AuthBackgroundImageId);
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

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record AppConfigPayload(
        string ClubName,
        string ThemeId,
        string AuthBackgroundImageId);

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(
        bool IsAuthenticated,
        string CsrfToken,
        UserPayload? User,
        bool BootstrapMode);

    private sealed record UserPayload(bool MustChangePassword);

    private sealed class AppConfigAppFactory(
        string? clubName = null,
        string? themeId = null,
        string? authBackgroundImageId = null) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.Sources.Clear();

                var configuration = new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "headcoach",
                    ["BootstrapUser:FullName"] = "Главный тренер"
                };

                if (clubName is not null)
                {
                    configuration["Branding:ClubName"] = clubName;
                }

                if (themeId is not null)
                {
                    configuration["Branding:ThemeId"] = themeId;
                }

                if (authBackgroundImageId is not null)
                {
                    configuration["Branding:AuthBackgroundImageId"] = authBackgroundImageId;
                }

                configurationBuilder.AddInMemoryCollection(configuration);
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-app-config-tests-{Guid.NewGuid():N}";
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
