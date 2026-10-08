using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class AuditLogApiTests
{
    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("SuperAdministrator")]
    public async Task HeadCoach_or_SuperAdministrator_can_read_audit_log_and_filter_options(string actorRole)
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole == "HeadCoach"
            ? seeded.HeadCoach.Login
            : seeded.SuperAdministrator.Login;

        _ = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        await ReplaceAuditLogsAsync(factory, seeded);

        using var listResponse = await client.GetAsync(
            $"/audit-logs?page=1&pageSize=10&dateFrom=2026-04-12&dateTo=2026-04-12&userId={seeded.Coach.Id}&actionType=AttendanceUpdated&entityType=Attendance&source=Bot&messengerPlatform=Telegram");

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var payload = await ReadJsonElementAsync(listResponse);
        var items = GetArrayPayload(payload, "items");

        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
        Assert.False(payload.GetProperty("hasNextPage").GetBoolean());

        var item = items[0];
        Assert.Equal("AttendanceUpdated", item.GetProperty("actionType").GetString());
        Assert.Equal("Attendance", item.GetProperty("entityType").GetString());
        Assert.Equal("Запись посещения изменена.", item.GetProperty("description").GetString());
        Assert.Equal("Bot", item.GetProperty("source").GetString());
        Assert.Equal("Telegram", item.GetProperty("messengerPlatform").GetString());

        var user = item.GetProperty("user");
        Assert.Equal(seeded.Coach.Id.ToString(), user.GetProperty("id").GetString());
        Assert.Equal(seeded.Coach.Login, user.GetProperty("login").GetString());
        Assert.Equal("Coach", user.GetProperty("role").GetString());

        Assert.Equal("{\"isPresent\":true}", item.GetProperty("oldValueJson").GetString());
        Assert.Equal("{\"isPresent\":false}", item.GetProperty("newValueJson").GetString());

        using var optionsResponse = await client.GetAsync("/audit-logs/options");
        Assert.Equal(HttpStatusCode.OK, optionsResponse.StatusCode);

        var optionsPayload = await ReadJsonElementAsync(optionsResponse);
        var users = GetArrayPayload(optionsPayload, "users");
        var actionTypes = GetArrayPayload(optionsPayload, "actionTypes");
        var entityTypes = GetArrayPayload(optionsPayload, "entityTypes");
        var sources = GetArrayPayload(optionsPayload, "sources");
        var messengerPlatforms = GetArrayPayload(optionsPayload, "messengerPlatforms");

        Assert.Equal(3, users.GetArrayLength());
        Assert.Contains(
            users.EnumerateArray(),
            candidate => candidate.GetProperty("id").GetString() == seeded.HeadCoach.Id.ToString());
        Assert.Contains(
            actionTypes.EnumerateArray(),
            candidate => candidate.GetString() == "AttendanceUpdated");
        Assert.Contains(
            entityTypes.EnumerateArray(),
            candidate => candidate.GetString() == "Attendance");
        Assert.Contains(
            sources.EnumerateArray(),
            candidate => candidate.GetString() == "Bot");
        Assert.Contains(
            messengerPlatforms.EnumerateArray(),
            candidate => candidate.GetString() == "Telegram");
    }

    [Fact]
    public async Task Audit_log_supports_pagination()
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoach.Login, seeded.SharedPassword);
        await ReplaceAuditLogsAsync(factory, seeded);

        using var firstPageResponse = await client.GetAsync("/audit-logs?page=1&pageSize=1");
        Assert.Equal(HttpStatusCode.OK, firstPageResponse.StatusCode);

        var firstPagePayload = await ReadJsonElementAsync(firstPageResponse);
        Assert.Equal(3, firstPagePayload.GetProperty("totalCount").GetInt32());
        Assert.True(firstPagePayload.GetProperty("hasNextPage").GetBoolean());

        var firstPageItems = GetArrayPayload(firstPagePayload, "items");
        Assert.Equal(1, firstPageItems.GetArrayLength());
        Assert.Equal("AttendanceUpdated", firstPageItems[0].GetProperty("actionType").GetString());

        using var secondPageResponse = await client.GetAsync("/audit-logs?page=2&pageSize=1");
        Assert.Equal(HttpStatusCode.OK, secondPageResponse.StatusCode);

        var secondPagePayload = await ReadJsonElementAsync(secondPageResponse);
        var secondPageItems = GetArrayPayload(secondPagePayload, "items");
        Assert.Equal(1, secondPageItems.GetArrayLength());
        Assert.Equal("ClientUpdated", secondPageItems[0].GetProperty("actionType").GetString());
    }

    [Theory]
    [InlineData("Administrator", HttpStatusCode.Forbidden)]
    [InlineData("Coach", HttpStatusCode.Forbidden)]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    public async Task Audit_read_denies_before_parsing_filters_without_disclosing_payloads(
        string? role, HttpStatusCode expected)
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        if (role is not null)
        {
            _ = await LoginAsync(client,
                role == "Administrator" ? seeded.Administrator.Login : seeded.Coach.Login,
                seeded.SharedPassword);
        }
        await ReplaceAuditLogsAsync(factory, seeded);

        foreach (var path in new[] { "/audit-logs", "/audit-logs/options", "/access/audit-log" })
        {
            foreach (var query in new[] { "", "?page=invalid&dateFrom=2026-04-31&userId=not-a-guid" })
            {
                using var response = await client.GetAsync(path + query);
                Assert.Equal(expected, response.StatusCode);
                Assert.Empty(await response.Content.ReadAsStringAsync());
            }
        }
    }

    [Theory]
    [InlineData("HeadCoach", true)]
    [InlineData("SuperAdministrator", true)]
    [InlineData("Administrator", false)]
    [InlineData("Coach", false)]
    public async Task Existing_cookie_uses_current_audit_permissions_without_another_login(string role, bool allowed)
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var actor = role switch
        {
            "HeadCoach" => seeded.HeadCoach,
            "SuperAdministrator" => seeded.SuperAdministrator,
            "Administrator" => seeded.Administrator,
            _ => seeded.Coach
        };
        var login = await LoginAsync(client, actor.Login, seeded.SharedPassword);
        var session = await GetSessionAsync(client);
        foreach (var snapshot in new[] { login, session })
        {
            Assert.True(snapshot.IsAuthenticated);
            Assert.NotNull(snapshot.User);
            Assert.Equal(allowed, snapshot.User.Permissions.CanViewAuditLog);
            Assert.Equal(allowed, snapshot.User.AllowedSections.Contains("Audit"));
        }
        foreach (var path in new[] { "/audit-logs", "/audit-logs/options", "/access/audit-log" })
        {
            using var response = await client.GetAsync(path);
            Assert.Equal(allowed ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Supported_staff_update_invalidates_existing_audit_reader_cookie(bool remainsActive)
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var reader = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        using var owner = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        _ = await LoginAsync(reader, seeded.SuperAdministrator.Login, seeded.SharedPassword);
        var ownerSession = await LoginAsync(owner, seeded.HeadCoach.Login, seeded.SharedPassword);
        using var before = await reader.GetAsync("/audit-logs");
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);

        using var update = new HttpRequestMessage(HttpMethod.Put, $"/settings/administrators/{seeded.SuperAdministrator.Id}")
        {
            Content = JsonContent.Create(new
            {
                FullName = "Updated audit reader",
                seeded.SuperAdministrator.Login,
                Role = "SuperAdministrator",
                MustChangePassword = false,
                IsActive = remainsActive,
                BranchId = (Guid?)null
            })
        };
        update.Headers.Add("X-CSRF-TOKEN", ownerSession.CsrfToken);
        using var updated = await owner.SendAsync(update);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        foreach (var path in new[] { "/audit-logs", "/audit-logs/options" })
        {
            using var response = await reader.GetAsync(path);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Empty(await response.Content.ReadAsStringAsync());
        }
        Assert.False((await GetSessionAsync(reader)).IsAuthenticated);
    }

    [Fact]
    public async Task Password_change_required_reader_cannot_read_audit_payloads()
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var user = await db.Users.SingleAsync(user => user.Id == seeded.SuperAdministrator.Id);
            user.MustChangePassword = true;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        _ = await LoginAsync(client, seeded.SuperAdministrator.Login, seeded.SharedPassword);
        foreach (var path in new[] { "/audit-logs", "/audit-logs/options" })
        {
            using var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var payload = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("items", payload);
            Assert.DoesNotContain("users", payload);
            Assert.DoesNotContain("totalCount", payload);
        }
    }

    [Fact]
    public async Task Audit_log_rejects_invalid_filters()
    {
        await using var factory = new AuditLogAppFactory();
        var seeded = await SeedUsersAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoach.Login, seeded.SharedPassword);

        using var response = await client.GetAsync("/audit-logs?dateFrom=2026-04-31&userId=not-a-guid");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");

        Assert.True(errors.TryGetProperty("dateFrom", out _));
        Assert.True(errors.TryGetProperty("userId", out _));
    }

    private static async Task<SeededUsers> SeedUsersAsync(AuditLogAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = new DateTimeOffset(2026, 04, 10, 9, 0, 0, TimeSpan.Zero);
        var sharedPassword = "audit-log-password";

        var headCoach = CreateUser(
            "headcoach-audit",
            "Главный тренер Аудит",
            UserRole.HeadCoach,
            sharedPassword,
            now,
            passwordHashService);
        var administrator = CreateUser(
            "administrator-audit",
            "Администратор Аудит",
            UserRole.Administrator,
            sharedPassword,
            now,
            passwordHashService);
        var coach = CreateUser(
            "coach-audit",
            "Тренер Аудит",
            UserRole.Coach,
            sharedPassword,
            now,
            passwordHashService);

        var superAdministrator = CreateUser(
            "superadministrator-audit", "Супер-администратор Аудит", UserRole.SuperAdministrator,
            sharedPassword, now, passwordHashService);
        dbContext.Users.AddRange(headCoach, superAdministrator, administrator, coach);
        await dbContext.SaveChangesAsync();

        return new SeededUsers(headCoach, superAdministrator, administrator, coach, sharedPassword);
    }

    private static async Task ReplaceAuditLogsAsync(AuditLogAppFactory factory, SeededUsers seeded)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        dbContext.AuditLogs.RemoveRange(dbContext.AuditLogs);

        dbContext.AuditLogs.AddRange(
            new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = seeded.HeadCoach.Id,
                ActionType = "Login",
                EntityType = "UserSession",
                EntityId = seeded.HeadCoach.Id.ToString(),
                Description = "Пользователь вошёл в систему.",
                Source = "Web",
                OldValueJson = null,
                NewValueJson = null,
                CreatedAt = new DateTimeOffset(2026, 04, 10, 8, 0, 0, TimeSpan.Zero)
            },
            new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = seeded.Administrator.Id,
                ActionType = "ClientUpdated",
                EntityType = "Client",
                EntityId = Guid.NewGuid().ToString(),
                Description = "Карточка клиента изменена.",
                Source = "Web",
                OldValueJson = "{\"phone\":\"+79990000001\"}",
                NewValueJson = "{\"phone\":\"+79990000002\"}",
                CreatedAt = new DateTimeOffset(2026, 04, 11, 12, 30, 0, TimeSpan.Zero)
            },
            new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = seeded.Coach.Id,
                ActionType = "AttendanceUpdated",
                EntityType = "Attendance",
                EntityId = Guid.NewGuid().ToString(),
                Description = "Запись посещения изменена.",
                Source = "Bot",
                MessengerPlatform = "Telegram",
                MessengerPlatformUserIdHash = "hashed-telegram-user",
                OldValueJson = "{\"isPresent\":true}",
                NewValueJson = "{\"isPresent\":false}",
                CreatedAt = new DateTimeOffset(2026, 04, 12, 19, 15, 0, TimeSpan.Zero)
            });

        await dbContext.SaveChangesAsync();
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
        string uri,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = JsonContent.Create(payload)
        };

        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static JsonElement GetArrayPayload(JsonElement payload, params string[] alternativeNames)
    {
        if (payload.ValueKind == JsonValueKind.Array)
        {
            return payload;
        }

        foreach (var name in alternativeNames)
        {
            if (payload.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.Array)
            {
                return property;
            }
        }

        throw new InvalidOperationException($"Не найден массив по именам: {string.Join(", ", alternativeNames)}.");
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var value = await response.Content.ReadFromJsonAsync<T>();
        return value ?? throw new InvalidOperationException("Ответ не содержит JSON payload.");
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

    private sealed record SeededUsers(
        User HeadCoach,
        User SuperAdministrator,
        User Administrator,
        User Coach,
        string SharedPassword);

    private sealed class AuditLogAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-audit",
                    ["BootstrapUser:FullName"] = "Bootstrap Audit"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-audit-tests-{Guid.NewGuid():N}";
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
