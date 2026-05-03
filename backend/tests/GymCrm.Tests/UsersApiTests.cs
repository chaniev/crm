using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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

public class UsersApiTests
{
    [Fact]
    public async Task HeadCoach_can_list_create_and_update_users()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var listResponse = await client.GetAsync("/users"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var usersPayload = await ReadJsonElementAsync(listResponse);
            Assert.Equal(JsonValueKind.Array, usersPayload.ValueKind);
            Assert.NotEmpty(usersPayload.EnumerateArray());
        }

        var createLogin = $"hc-user-{Guid.NewGuid():N}";
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Тестовый пользователь", createLogin, "12345Aa!", "Coach", false, true, "Telegram", "tg-user-001"),
                   session.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected user create success, got {createResponse.StatusCode}.");
        }

        Guid createdUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var createdUser = await dbContext.Users.SingleAsync(user => user.Login == createLogin);
            createdUserId = createdUser.Id;
            Assert.Equal(createLogin, createdUser.Login);
            Assert.Equal(MessengerPlatform.Telegram, createdUser.MessengerPlatform);
            Assert.Equal("tg-user-001", createdUser.MessengerPlatformUserId);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{createdUserId}",
                   new UserUpdateRequest("Обновлённый тестовый пользователь", createLogin, "Administrator", true, false, " ", " "),
                   session.CsrfToken))
        {
            Assert.True(
                updateResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent,
                $"Expected user update success, got {updateResponse.StatusCode}.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var updatedUser = await dbContext.Users.SingleAsync(user => user.Id == createdUserId);

            Assert.Equal(createLogin, updatedUser.Login);
            Assert.Equal("Обновлённый тестовый пользователь", updatedUser.FullName);
            Assert.Equal(UserRole.Administrator, updatedUser.Role);
            Assert.True(updatedUser.MustChangePassword);
            Assert.False(updatedUser.IsActive);
            Assert.Null(updatedUser.MessengerPlatform);
            Assert.Null(updatedUser.MessengerPlatformUserId);
        }
    }

    [Fact]
    public async Task HeadCoach_cannot_assign_duplicate_telegram_identity_to_another_user()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        var firstLogin = $"tg-user-{Guid.NewGuid():N}";
        using (var firstResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Telegram One", firstLogin, "12345Aa!", "Coach", false, true, "Telegram", "duplicate-telegram-id"),
                   session.CsrfToken))
        {
            Assert.True(firstResponse.IsSuccessStatusCode);
        }

        using var duplicateResponse = await PostJsonAsync(
            client,
            "/users",
            new UserCreateRequest("Telegram Two", $"tg-user-{Guid.NewGuid():N}", "12345Aa!", "Coach", false, true, "Telegram", "duplicate-telegram-id"),
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);

        var payload = await ReadJsonElementAsync(duplicateResponse);
        Assert.Equal(
            "Этот идентификатор мессенджера уже привязан к другому пользователю.",
            payload.GetProperty("errors").GetProperty("messengerPlatformUserId")[0].GetString());
    }

    [Fact]
    public async Task Create_user_validation_reports_expected_error_keys_and_full_name_contract()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/users",
            new UserCreateRequest(" ", " ", "", "InvalidRole", false, true),
            session.CsrfToken);

        var errors = await ReadValidationErrorsAsync(response);

        AssertHasError(errors, "fullName");
        AssertHasError(errors, "login");
        AssertHasError(errors, "password");
        AssertHasError(errors, "role");
        AssertDoesNotHaveError(errors, "lastName");
    }

    [Fact]
    public async Task User_validation_rejects_head_coach_creation_assignment_and_invalid_messenger_identity()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var createHeadCoachResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(
                       "Новый главный тренер",
                       $"new-headcoach-{Guid.NewGuid():N}",
                       "12345Aa!",
                       "HeadCoach",
                       false,
                       true),
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(createHeadCoachResponse);
            AssertHasError(errors, "role");
        }

        using (var assignHeadCoachResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.CoachId}",
                   new UserUpdateRequest(
                       " ",
                       seeded.CoachLogin,
                       "HeadCoach",
                       false,
                       true),
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(assignHeadCoachResponse);
            AssertHasError(errors, "fullName");
            AssertHasError(errors, "role");
            AssertDoesNotHaveError(errors, "lastName");
        }

        using (var missingMessengerPlatformResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(
                       "Messenger Partial",
                       $"messenger-partial-{Guid.NewGuid():N}",
                       "12345Aa!",
                       "Coach",
                       false,
                       true,
                       MessengerPlatformUserId: "telegram-id-without-platform"),
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(missingMessengerPlatformResponse);
            AssertHasError(errors, "messengerPlatform");
        }

        using (var missingMessengerUserIdResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(
                       "Messenger Partial",
                       $"messenger-partial-{Guid.NewGuid():N}",
                       "12345Aa!",
                       "Coach",
                       false,
                       true,
                       MessengerPlatform: "Telegram"),
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(missingMessengerUserIdResponse);
            AssertHasError(errors, "messengerPlatformUserId");
        }

        using (var tooLongMessengerUserIdResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(
                       "Messenger Too Long",
                       $"messenger-too-long-{Guid.NewGuid():N}",
                       "12345Aa!",
                       "Coach",
                       false,
                       true,
                       "Telegram",
                       new string('x', 129)),
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(tooLongMessengerUserIdResponse);
            AssertHasError(errors, "messengerPlatformUserId");
        }
    }

    [Theory]
    [InlineData("Administrator")]
    [InlineData("Coach")]
    public async Task Administrator_and_Coach_cannot_access_users_endpoints(string actorRole)
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole == "Administrator"
            ? seeded.AdministratorLogin
            : seeded.CoachLogin;

        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);

        Assert.NotNull(session.User);
        Assert.Equal(actorRole, session.User.Role);

        using (var listResponse = await client.GetAsync("/users"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Недоступный пользователь", "forbidden-user", "12345Aa!", "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.HeadCoachId}",
                   new UserUpdateRequest("Обновлённый", seeded.HeadCoachLogin, "HeadCoach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }
    }

    [Fact]
    public async Task HeadCoach_cannot_update_login_field_on_put_users()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        var originalLogin = $"no-login-update-{Guid.NewGuid():N}";
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Безопасный пользователь", originalLogin, "12345Aa!", "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected user create success, got {createResponse.StatusCode}.");
        }

        Guid userId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var createdUser = await dbContext.Users.SingleAsync(user => user.Login == originalLogin);
            userId = createdUser.Id;
        }

        var changedLogin = $"changed-{originalLogin}";
        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{userId}",
                   new UserUpdateRequest("Безопасный пользователь", changedLogin, "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.False(updateResponse.IsSuccessStatusCode, "User update with login change must be rejected.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var unchangedUser = await dbContext.Users.SingleAsync(user => user.Id == userId);

            Assert.Equal(originalLogin, unchangedUser.Login);
        }
    }

    [Fact]
    public async Task HeadCoach_self_update_keeps_current_session_in_sync()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.HeadCoachId}",
                   new UserUpdateRequest("Главный тренер Stage 4 Обновлённый", seeded.HeadCoachLogin, "HeadCoach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        }

        var updatedSession = await GetSessionAsync(client);

        Assert.True(updatedSession.IsAuthenticated);
        Assert.NotNull(updatedSession.User);
        Assert.Equal("Главный тренер Stage 4 Обновлённый", updatedSession.User.FullName);
        Assert.Equal("HeadCoach", updatedSession.User.Role);

        using var profileResponse = await client.GetAsync("/auth/profile");
        Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
    }

    [Fact]
    public async Task User_create_and_update_write_audit_without_password_data()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        var createLogin = $"audit-user-{Guid.NewGuid():N}";
        int logsBeforeCreate;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            logsBeforeCreate = await dbContext.AuditLogs.CountAsync(log =>
                log.EntityType == "User" && log.UserId == seeded.HeadCoachId);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Аудит пользователь", createLogin, "12345Aa!", "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected user create success, got {createResponse.StatusCode}.");
        }

        Guid userId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var createdUser = await dbContext.Users.SingleAsync(user => user.Login == createLogin);
            userId = createdUser.Id;
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var createAuditLogs = await dbContext.AuditLogs
                .Where(log => log.UserId == seeded.HeadCoachId && log.EntityType == "User")
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();

            Assert.True(createAuditLogs.Count > logsBeforeCreate);
            foreach (var log in createAuditLogs)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }

            var createLog = await dbContext.AuditLogs.SingleAsync(log =>
                log.ActionType == "UserCreated" &&
                log.EntityId == userId.ToString());

            Assert.Equal(
                $"Пользователь '{seeded.HeadCoachLogin}' создал пользователя '{createLogin}'.",
                createLog.Description);
        }

        int logsBeforeUpdate;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            logsBeforeUpdate = await dbContext.AuditLogs.CountAsync(log =>
                log.EntityType == "User" && log.UserId == seeded.HeadCoachId);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{userId}",
                   new UserUpdateRequest("Аудит пользователь v2", createLogin, "Administrator", true, false),
                   session.CsrfToken))
        {
            Assert.True(
                updateResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent,
                $"Expected user update success, got {updateResponse.StatusCode}.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var updateAuditLogs = await dbContext.AuditLogs
                .Where(log => log.EntityType == "User" && log.UserId == seeded.HeadCoachId)
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();

            Assert.True(updateAuditLogs.Count > logsBeforeUpdate);

            foreach (var log in updateAuditLogs)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }

            var updateLog = await dbContext.AuditLogs.SingleAsync(log =>
                log.ActionType == "UserUpdated" &&
                log.EntityId == userId.ToString());

            Assert.Equal(
                $"Пользователь '{seeded.HeadCoachLogin}' изменил пользователя '{createLogin}'.",
                updateLog.Description);
        }
    }

    private static async Task<SeededUsersData> SeedUsersDataAsync(UsersAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage4-password";

        var headCoach = CreateUser("headcoach-stage4", "Главный тренер Stage 4", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage4", "Администратор Stage 4", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage4", "Тренер Stage 4", UserRole.Coach, sharedPassword, now, passwordHashService);

        dbContext.Users.AddRange(headCoach, administrator, coach);
        await dbContext.SaveChangesAsync();

        return new SeededUsersData(
            headCoach.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Login,
            sharedPassword);
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

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload;
    }

    private static async Task<JsonElement> ReadValidationErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        Assert.True(
            payload.TryGetProperty("errors", out var errors),
            "Expected validation problem payload to contain an errors object.");

        return errors;
    }

    private static void AssertHasError(JsonElement errors, string propertyName)
    {
        Assert.True(
            HasError(errors, propertyName),
            $"Expected validation error for '{propertyName}'.");
    }

    private static void AssertDoesNotHaveError(JsonElement errors, string propertyName)
    {
        Assert.False(
            HasError(errors, propertyName),
            $"Did not expect validation error for '{propertyName}'.");
    }

    private static bool HasError(JsonElement errors, string propertyName)
    {
        return errors.ValueKind == JsonValueKind.Object &&
            errors.TryGetProperty(propertyName, out var propertyErrors) &&
            propertyErrors.ValueKind == JsonValueKind.Array &&
            propertyErrors.GetArrayLength() > 0;
    }

    private static void AssertNoPasswordInAuditState(string? jsonPayload)
    {
        if (string.IsNullOrWhiteSpace(jsonPayload))
        {
            return;
        }

        if (ContainsPasswordFieldInJson(jsonPayload))
        {
            Assert.Fail("Audit payload contains password-related fields.");
        }
    }

    private static bool ContainsPasswordFieldInJson(string jsonPayload)
    {
        try
        {
            using var document = JsonDocument.Parse(jsonPayload);
            return ContainsPasswordField(document.RootElement);
        }
        catch (JsonException)
        {
            return jsonPayload.Contains("password", StringComparison.OrdinalIgnoreCase);
        }
    }

    private static bool ContainsPasswordField(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name.Contains("password", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (ContainsPasswordField(property.Value))
                {
                    return true;
                }
            }

            return false;
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (ContainsPasswordField(item))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private sealed record SeededUsersData(
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword);

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

    private sealed record UserCreateRequest(
        string FullName,
        string Login,
        string Password,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string? MessengerPlatform = null,
        string? MessengerPlatformUserId = null);

    private sealed record UserUpdateRequest(
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string? MessengerPlatform = null,
        string? MessengerPlatformUserId = null);

    private sealed class UsersAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-stage4",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 4"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-users-tests-{Guid.NewGuid():N}";
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
