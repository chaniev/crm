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

public class BranchesApiTests
{
    [Fact]
    public async Task Membership_catalog_supports_scoped_crud_eligible_and_rejects_immutable_update_and_delete()
    {
        await using var factory = new BranchesAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        Guid branchId;
        using (var branchResponse = await PostJsonAsync(client, "/branches",
                   new { Name = "Catalog branch", Address = "", Description = "" }, session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, branchResponse.StatusCode);
            branchId = GetGuidFromProperty(await ReadJsonElementAsync(branchResponse), "id");
        }

        Guid itemId;
        using (var response = await PostJsonAsync(client, "/settings/membership-catalog",
                   new
                   {
                       BranchId = branchId,
                       Name = "  Дневной   абонемент ",
                       Price = 1500m,
                       BehaviorKind = "Term",
                       AvailableFrom = new DateOnly(2020, 1, 1),
                       AvailableTo = (DateOnly?)null
                   }, session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            itemId = GetGuidFromProperty(payload, "id");
            Assert.Equal(1500m, payload.GetProperty("price").GetDecimal());
            Assert.Equal("Term", payload.GetProperty("behaviorKind").GetString());
        }

        using (var response = await client.GetAsync($"/settings/membership-catalog?branchId={branchId}"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            Assert.Contains(payload.EnumerateArray(), item => GetGuidFromProperty(item, "id") == itemId);
        }

        using (var response = await client.GetAsync($"/membership-catalog/eligible?branchId={branchId}"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            Assert.Contains(payload.EnumerateArray(), item => GetGuidFromProperty(item, "id") == itemId);
        }

        using (var response = await PutJsonAsync(client, $"/settings/membership-catalog/{itemId}",
                   new { Name = "Новое имя", AvailableFrom = new DateOnly(2020, 1, 1), AvailableTo = (DateOnly?)null, Price = 1m },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            Assert.Equal("membership_catalog_immutable", payload.GetProperty("code").GetString());
        }

        using var deleteResponse = await DeleteAsync(client, $"/settings/membership-catalog/{itemId}", session.CsrfToken);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Branch_and_hall_admin_flow_validates_archive_and_delete_guards()
    {
        await using var factory = new BranchesAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        Guid branchId;
        using (var createBranchResponse = await PostJsonAsync(
                   client,
                   "/branches",
                   new
                   {
                       Name = "Central",
                       Address = "Main street",
                       Description = "Primary branch"
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createBranchResponse);
            branchId = GetGuidFromProperty(payload, "id");
            Assert.Equal("Central", payload.GetProperty("name").GetString());
            Assert.False(payload.GetProperty("isArchived").GetBoolean());
        }

        using (var updateBranchResponse = await PutJsonAsync(
                   client,
                   $"/branches/{branchId}",
                   new
                   {
                       Name = "Central Updated",
                       Address = "Second street",
                       Description = "Updated branch"
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateBranchResponse);
            Assert.Equal("Central Updated", payload.GetProperty("name").GetString());
        }

        using (var archiveBranchResponse = await PutWithoutBodyAsync(client, $"/branches/{branchId}/archive", session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, archiveBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(archiveBranchResponse);
            Assert.True(payload.GetProperty("isArchived").GetBoolean());
        }

        using (var restoreBranchResponse = await PutWithoutBodyAsync(client, $"/branches/{branchId}/restore", session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, restoreBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(restoreBranchResponse);
            Assert.False(payload.GetProperty("isArchived").GetBoolean());
        }

        Guid hallId;
        using (var createHallResponse = await PostJsonAsync(
                   client,
                   "/halls",
                   new
                   {
                       BranchId = branchId,
                       Name = "Hall A",
                       Description = "Main hall"
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createHallResponse);
            hallId = GetGuidFromProperty(payload, "id");
            Assert.Equal(branchId, GetGuidFromProperty(payload, "branchId"));
            Assert.Equal("Hall A", payload.GetProperty("name").GetString());
        }

        using (var missingBranchResponse = await PostJsonAsync(
                   client,
                   "/halls",
                   new
                   {
                       BranchId = Guid.NewGuid(),
                       Name = "No branch",
                       Description = ""
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(missingBranchResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var groupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "Branch Guard Type",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            dbContext.GroupTypes.Add(groupType);
            dbContext.TrainingGroups.Add(new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = branchId,
                HallId = hallId,
                GroupTypeId = groupType.Id,
                Name = "Hall Guard Group",
                TrainingStartTime = new TimeOnly(9, 0),
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        using (var archiveHallResponse = await PutWithoutBodyAsync(client, $"/halls/{hallId}/archive", session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, archiveHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(archiveHallResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("hall", out _));
        }

        using (var deleteHallResponse = await DeleteAsync(client, $"/halls/{hallId}", session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, deleteHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(deleteHallResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("hall", out _));
        }
    }

    private static async Task<SeededBranchData> SeedDataAsync(BranchesAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "branches-password";
        var headCoach = CreateUser("headcoach-branches", "HeadCoach Branches", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        dbContext.Users.Add(headCoach);
        await dbContext.SaveChangesAsync();

        return new SeededBranchData(headCoach.Login, sharedPassword);
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
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
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

    private static async Task<HttpResponseMessage> DeleteAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static Guid GetGuidFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            Guid.TryParse(property.GetString(), out var value)
            ? value
            : Guid.Empty;
    }

    private sealed record SeededBranchData(string HeadCoachLogin, string SharedPassword);

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

    private sealed record LoginRequest(string Login, string Password);

    private sealed class BranchesAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-branches",
                    ["BootstrapUser:FullName"] = "Bootstrap Branches"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-branches-tests-{Guid.NewGuid():N}";
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
