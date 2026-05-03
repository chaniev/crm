using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Clients;
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

public class CsrfProtectionTests
{
    [Fact]
    public async Task State_changing_endpoints_reject_missing_and_invalid_csrf_tokens()
    {
        await using var factory = new CsrfAppFactory();
        var seeded = await SeedCsrfDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd");
        var scenarios = new (string Name, Func<HttpRequestMessage> CreateRequest)[]
        {
            ("users", () => CreateJsonRequest(
                HttpMethod.Post,
                "/users",
                new
                {
                    FullName = "CSRF User",
                    Login = $"csrf-user-{Guid.NewGuid():N}",
                    Password = "12345Aa!",
                    Role = "Coach",
                    MustChangePassword = false,
                    IsActive = true
                })),
            ("clients", () => CreateJsonRequest(
                HttpMethod.Post,
                "/clients",
                new
                {
                    LastName = "CSRF",
                    FirstName = "Client",
                    Phone = $"+7999{Random.Shared.Next(1000000, 9999999)}",
                    Contacts = Array.Empty<object>(),
                    GroupIds = new[] { seeded.GroupId }
                })),
            ("groups", () => CreateJsonRequest(
                HttpMethod.Post,
                "/groups",
                new
                {
                    Name = $"CSRF Group {Guid.NewGuid():N}",
                    TrainingStartTime = "18:00:00",
                    ScheduleText = "Пн-Ср",
                    IsActive = true
                })),
            ("attendance", () => CreateJsonRequest(
                HttpMethod.Post,
                $"/attendance/groups/{seeded.GroupId}",
                new
                {
                    TrainingDate = today,
                    AttendanceMarks = new[]
                    {
                        new
                        {
                            ClientId = seeded.ClientId,
                            IsPresent = true
                        }
                    }
                })),
            ("client photo", () => CreatePhotoRequest(seeded.ClientId))
        };

        foreach (var scenario in scenarios)
        {
            using var missingTokenRequest = scenario.CreateRequest();
            using var missingTokenResponse = await client.SendAsync(missingTokenRequest);
            Assert.Equal(HttpStatusCode.BadRequest, missingTokenResponse.StatusCode);

            using var invalidTokenRequest = scenario.CreateRequest();
            invalidTokenRequest.Headers.Add("X-CSRF-TOKEN", "invalid-csrf-token");
            using var invalidTokenResponse = await client.SendAsync(invalidTokenRequest);
            Assert.Equal(HttpStatusCode.BadRequest, invalidTokenResponse.StatusCode);
        }
    }

    private static async Task<SeededCsrfData> SeedCsrfDataAsync(CsrfAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "csrf-password";

        var headCoach = CreateUser(
            "headcoach-csrf",
            "Главный тренер CSRF",
            UserRole.HeadCoach,
            sharedPassword,
            now,
            passwordHashService);
        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "CSRF Group",
            TrainingStartTime = new TimeOnly(9, 0),
            ScheduleText = "Пн,Ср,Пт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "CSRF",
            FirstName = "Client",
            Phone = "+79990001234",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.Add(headCoach);
        dbContext.TrainingGroups.Add(group);
        dbContext.Clients.Add(client);
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = client.Id,
            GroupId = group.Id
        });
        await dbContext.SaveChangesAsync();

        return new SeededCsrfData(
            headCoach.Login,
            sharedPassword,
            group.Id,
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

    private static async Task<HttpResponseMessage> PostJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = CreateJsonRequest(HttpMethod.Post, path, payload);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static HttpRequestMessage CreateJsonRequest<TPayload>(
        HttpMethod method,
        string path,
        TPayload payload)
    {
        return new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(payload)
        };
    }

    private static HttpRequestMessage CreatePhotoRequest(Guid clientId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{clientId}/photo");
        var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(CreateSamplePngBytes());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        multipart.Add(fileContent, "photo", "csrf.png");
        request.Content = multipart;

        return request;
    }

    private static byte[] CreateSamplePngBytes()
    {
        return
        [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ];
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record SeededCsrfData(
        string HeadCoachLogin,
        string SharedPassword,
        Guid GroupId,
        Guid ClientId);

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role);

    private sealed class CsrfAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-csrf",
                    ["BootstrapUser:FullName"] = "Bootstrap CSRF"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-csrf-tests-{Guid.NewGuid():N}";
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
