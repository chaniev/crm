using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

[Collection(StartupLoggingCollection.Name)]
public class StartupLoggingSmokeTests
{
    [Fact]
    public async Task Bootstrap_user_is_seeded_once_across_repeated_startups()
    {
        var databaseRoot = new InMemoryDatabaseRoot();
        var databaseName = $"gym-crm-bootstrap-repeat-{Guid.NewGuid():N}";

        await using (var firstFactory = new StartupAppFactory(
                         databaseRoot,
                         databaseName,
                         technicalLoggingEnabled: false))
        {
            using var client = firstFactory.CreateClient();
            using var response = await client.GetAsync("/");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var scope = firstFactory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(1, await dbContext.Users.CountAsync(user => user.Login == "bootstrap-repeat"));
        }

        await using (var secondFactory = new StartupAppFactory(
                         databaseRoot,
                         databaseName,
                         technicalLoggingEnabled: false))
        {
            using var client = secondFactory.CreateClient();
            using var response = await client.GetAsync("/");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var scope = secondFactory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(1, await dbContext.Users.CountAsync(user => user.Login == "bootstrap-repeat"));
        }
    }

    [Fact]
    public async Task Technical_logging_writes_request_summary_without_password_cookie_or_csrf_data()
    {
        var databaseRoot = new InMemoryDatabaseRoot();
        var databaseName = $"gym-crm-technical-logging-{Guid.NewGuid():N}";
        var logDirectory = Directory.CreateTempSubdirectory("gym-crm-api-logs-");
        StartupAppFactory? factory = null;

        try
        {
            factory = new StartupAppFactory(
                databaseRoot,
                databaseName,
                technicalLoggingEnabled: true,
                logDirectory: logDirectory.FullName);
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });

            using var sessionResponse = await client.GetAsync("/auth/session");
            var session = await ReadJsonAsync<SessionPayload>(sessionResponse);

            Assert.Equal(HttpStatusCode.OK, sessionResponse.StatusCode);
            Assert.False(string.IsNullOrWhiteSpace(session.CsrfToken));

            using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
            {
                Content = JsonContent.Create(new LoginRequest("bootstrap-repeat", "12345678"))
            };
            loginRequest.Headers.Add("X-CSRF-TOKEN", session.CsrfToken);

            using var loginResponse = await client.SendAsync(loginRequest);

            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

            await factory.DisposeAsync();
            factory = null;

            var logFiles = Directory.GetFiles(logDirectory.FullName, "*.log*");
            Assert.Single(logFiles);
            Assert.Matches(@"gym-crm-api-\d{8}-\d{6}", Path.GetFileName(logFiles[0]));

            var logContents = await File.ReadAllTextAsync(logFiles[0]);
            Assert.Single(Regex.Matches(
                logContents,
                @"HTTP GET /auth/session responded 200 in \d+(\.\d+)? ms"));
            Assert.Single(Regex.Matches(
                logContents,
                @"HTTP POST /auth/login responded 200 in \d+(\.\d+)? ms"));
            Assert.DoesNotContain("12345678", logContents, StringComparison.Ordinal);
            Assert.DoesNotContain("passwordhash", logContents, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("gym-crm.auth", logContents, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("gym-crm.csrf", logContents, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("X-CSRF-TOKEN", logContents, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            if (factory is not null)
            {
                await factory.DisposeAsync();
            }

            logDirectory.Delete(recursive: true);
        }
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken);

    private sealed class StartupAppFactory(
        InMemoryDatabaseRoot databaseRoot,
        string databaseName,
        bool technicalLoggingEnabled,
        string? logDirectory = null) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] =
                        "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-repeat",
                    ["BootstrapUser:FullName"] = "Bootstrap Repeat",
                    ["TechnicalLogging:Enabled"] = technicalLoggingEnabled.ToString(),
                    ["TechnicalLogging:DirectoryPath"] = logDirectory ?? "logs/technical"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName, databaseRoot)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }
    }

}

[CollectionDefinition(StartupLoggingCollection.Name, DisableParallelization = true)]
public sealed class StartupLoggingCollection : ICollectionFixture<object>
{
    public const string Name = "startup-logging";
}
