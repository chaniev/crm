using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
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
            var items = usersPayload.GetProperty("items");
            Assert.Equal(JsonValueKind.Array, items.ValueKind);
            Assert.NotEmpty(items.EnumerateArray());
            Assert.Equal(
                ["Administrator", "Coach", "SuperAdministrator"],
                usersPayload.GetProperty("createRoleOptions").EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToArray());
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
                   new UserUpdateRequest("Обновлённый тестовый пользователь", createLogin, "Coach", true, false, " ", " "),
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
            Assert.Equal(UserRole.Coach, updatedUser.Role);
            Assert.True(updatedUser.MustChangePassword);
            Assert.False(updatedUser.IsActive);
            Assert.Null(updatedUser.MessengerPlatform);
            Assert.Null(updatedUser.MessengerPlatformUserId);
        }
    }

    [Fact]
    public async Task Users_flow_requires_active_branch_for_administrator_role()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(
                       "Новый администратор",
                       $"admin-outside-settings-{Guid.NewGuid():N}",
                       "12345Aa!",
                       "Administrator",
                       true,
                       true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, createResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.CoachId}",
                   new UserUpdateRequest(
                       "Тренер как администратор",
                       seeded.CoachLogin,
                       "Administrator",
                       false,
                       true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
        }
    }

    [Fact]
    public async Task HeadCoach_can_list_create_and_update_administrators()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var listResponse = await client.GetAsync("/settings/administrators"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var payload = await ReadJsonElementAsync(listResponse);
            var items = payload.GetProperty("items");
            Assert.Equal(JsonValueKind.Array, items.ValueKind);
            Assert.Equal(
                ["Administrator", "Coach", "SuperAdministrator"],
                payload.GetProperty("createRoleOptions").EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToArray());
            Assert.All(items.EnumerateArray(), item =>
            {
                Assert.Equal("Administrator", GetStringFromProperty(item, "role"));
            });
        }

        var createLogin = $"settings-admin-{Guid.NewGuid():N}";
        Guid administratorId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/settings/administrators",
                   new
                   {
                       FullName = "Администратор из настроек",
                       Login = createLogin,
                       Password = "12345Aa!",
                       MustChangePassword = true,
                       IsActive = true,
                       MessengerPlatform = "Telegram",
                       MessengerPlatformUserId = "settings-admin-telegram",
                       BranchId = seeded.BranchId
                   },
                   session.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected administrator create success, got {createResponse.StatusCode}.");
            var payload = await ReadJsonElementAsync(createResponse);
            administratorId = GetGuidFromProperty(payload, "id");
            Assert.NotEqual(Guid.Empty, administratorId);
            Assert.Equal("Administrator", GetStringFromProperty(payload, "role"));
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/settings/administrators/{administratorId}",
                   new
                   {
                       FullName = "Администратор из настроек v2",
                       Login = createLogin,
                       MustChangePassword = false,
                       IsActive = false,
                       MessengerPlatform = (string?)null,
                       MessengerPlatformUserId = (string?)null,
                       BranchId = seeded.BranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal("Администратор из настроек v2", GetStringFromProperty(payload, "fullName"));
            Assert.Equal("Administrator", GetStringFromProperty(payload, "role"));
        }

        using (var usersListResponse = await client.GetAsync("/users"))
        {
            Assert.Equal(HttpStatusCode.OK, usersListResponse.StatusCode);
            var payload = await ReadJsonElementAsync(usersListResponse);
            Assert.Contains(
                payload.GetProperty("items").EnumerateArray(),
                item => GetStringFromProperty(item, "login") == createLogin);
        }
    }

    [Fact]
    public async Task Administrator_cannot_manage_administrators_through_settings_endpoint()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        using var listResponse = await client.GetAsync("/settings/administrators");
        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        await AssertProblemDetailsAsync(
            listResponse,
            "/problems/staff-management-forbidden",
            "staff_management_forbidden");

        using var createResponse = await PostJsonAsync(
            client,
            "/settings/administrators",
            new
            {
                FullName = "Недоступный администратор",
                Login = $"admin-forbidden-{Guid.NewGuid():N}",
                Password = "12345Aa!",
                MustChangePassword = true,
                IsActive = true,
                BranchId = seeded.BranchId
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        await AssertProblemDetailsAsync(
            createResponse,
            "/problems/staff-management-forbidden",
            "staff_management_forbidden");

        using var updateResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}",
            new
            {
                FullName = " ",
                Login = "changed-login",
                MustChangePassword = true,
                IsActive = true,
                BranchId = Guid.NewGuid()
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        await AssertProblemDetailsAsync(
            updateResponse,
            "/problems/staff-management-forbidden",
            "staff_management_forbidden");
    }

    [Fact]
    public async Task Settings_administrator_create_ignores_role_payload_and_persists_administrator()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var createLogin = $"settings-admin-overpost-{Guid.NewGuid():N}";

        using var createResponse = await PostJsonAsync(
            client,
            "/settings/administrators",
            new
            {
                FullName = "Администратор с лишней ролью",
                Login = createLogin,
                Password = "12345Aa!",
                Role = "Coach",
                MustChangePassword = true,
                IsActive = true,
                BranchId = seeded.BranchId
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var payload = await ReadJsonElementAsync(createResponse);
        Assert.Equal("Administrator", GetStringFromProperty(payload, "role"));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var createdUser = await dbContext.Users.SingleAsync(user => user.Login == createLogin);

        Assert.Equal(UserRole.Administrator, createdUser.Role);
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
    public async Task User_validation_keeps_input_errors_and_head_coach_role_attempts_use_staff_denial()
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
            Assert.Equal(HttpStatusCode.Forbidden, createHeadCoachResponse.StatusCode);
            await AssertProblemDetailsAsync(
                createHeadCoachResponse,
                "/problems/staff-role-transition-forbidden",
                "staff_role_transition_forbidden");
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
            Assert.Equal(HttpStatusCode.Forbidden, assignHeadCoachResponse.StatusCode);
            await AssertProblemDetailsAsync(
                assignHeadCoachResponse,
                "/problems/staff-role-transition-forbidden",
                "staff_role_transition_forbidden");
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
            await AssertProblemDetailsAsync(
                listResponse,
                "/problems/staff-management-forbidden",
                "staff_management_forbidden");
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest(" ", " ", "", "InvalidRole", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
            await AssertProblemDetailsAsync(
                createResponse,
                "/problems/staff-management-forbidden",
                "staff_management_forbidden");
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.HeadCoachId}",
                   new UserUpdateRequest(" ", "changed-login", "InvalidRole", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
            await AssertProblemDetailsAsync(
                updateResponse,
                "/problems/staff-management-forbidden",
                "staff_management_forbidden");
        }
    }

    [Fact]
    public async Task SuperAdministrator_forbidden_staff_role_attempts_return_deterministic_problem_without_mutation_or_audit()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        var createHeadCoachLogin = $"sa-create-headcoach-{Guid.NewGuid():N}";
        var createPeerSuperAdministratorLogin = $"sa-create-super-admin-{Guid.NewGuid():N}";
        int userCountBefore;
        int auditCountBefore;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            userCountBefore = await dbContext.Users.CountAsync();
            auditCountBefore = await dbContext.AuditLogs.CountAsync(log => log.EntityType == "User");
        }

        using (var createHeadCoachResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Попытка главного тренера", createHeadCoachLogin, "12345Aa!", "HeadCoach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createHeadCoachResponse.StatusCode);
            await AssertProblemDetailsAsync(
                createHeadCoachResponse,
                "/problems/staff-role-transition-forbidden",
                "staff_role_transition_forbidden");
        }

        using (var createSuperAdministratorResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new UserCreateRequest("Попытка суперадминистратора", createPeerSuperAdministratorLogin, "12345Aa!", "SuperAdministrator", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createSuperAdministratorResponse.StatusCode);
            await AssertProblemDetailsAsync(
                createSuperAdministratorResponse,
                "/problems/staff-role-transition-forbidden",
                "staff_role_transition_forbidden");
        }

        using (var mutateHeadCoachResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.HeadCoachId}",
                   new UserUpdateRequest("Изменение главного тренера", seeded.HeadCoachLogin, "HeadCoach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, mutateHeadCoachResponse.StatusCode);
            await AssertProblemDetailsAsync(
                mutateHeadCoachResponse,
                "/problems/staff-target-forbidden",
                "staff_target_forbidden");
        }

        using (var demotePeerSuperAdministratorResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.PeerSuperAdministratorId}",
                   new UserUpdateRequest("Понижение суперадминистратора", seeded.PeerSuperAdministratorLogin, "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, demotePeerSuperAdministratorResponse.StatusCode);
            await AssertProblemDetailsAsync(
                demotePeerSuperAdministratorResponse,
                "/problems/staff-target-forbidden",
                "staff_target_forbidden");
        }

        using (var mutateSelfResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.SuperAdministratorId}",
                   new UserUpdateRequest(
                       "Изменение себя",
                       seeded.SuperAdministratorLogin,
                       "SuperAdministrator",
                       false,
                       true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, mutateSelfResponse.StatusCode);
            await AssertProblemDetailsAsync(
                mutateSelfResponse,
                "/problems/staff-self-mutation-forbidden",
                "staff_self_mutation_forbidden");
        }

        using (var missingTargetResponse = await PutJsonAsync(
                   client,
                   $"/users/{Guid.NewGuid()}",
                   new UserUpdateRequest("Missing Coach", "missing-coach", "Coach", false, true),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.NotFound, missingTargetResponse.StatusCode);
            await AssertProblemDetailsAsync(
                missingTargetResponse,
                "/problems/staff-not-found",
                "staff_not_found");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(userCountBefore, await dbContext.Users.CountAsync());
            Assert.False(await dbContext.Users.AnyAsync(user => user.Login == createHeadCoachLogin));
            Assert.False(await dbContext.Users.AnyAsync(user => user.Login == createPeerSuperAdministratorLogin));

            var headCoach = await dbContext.Users.SingleAsync(user => user.Id == seeded.HeadCoachId);
            var peerSuperAdministrator = await dbContext.Users.SingleAsync(user => user.Id == seeded.PeerSuperAdministratorId);

            Assert.Equal("Главный тренер Stage 4", headCoach.FullName);
            Assert.Equal(UserRole.HeadCoach, headCoach.Role);
            Assert.Equal(UserRole.SuperAdministrator, peerSuperAdministrator.Role);
            Assert.Equal(
                auditCountBefore,
                await dbContext.AuditLogs.CountAsync(log => log.EntityType == "User"));
        }
    }

    [Fact]
    public async Task HeadCoach_can_create_deactivate_and_reactivate_SuperAdministrator_but_cannot_change_its_role()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var login = $"headcoach-created-sa-{Guid.NewGuid():N}";
        Guid superAdministratorId;

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "HeadCoach created SA",
                       Login = login,
                       Password = "12345Aa!",
                       Role = "SuperAdministrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createResponse);
            superAdministratorId = GetGuidFromProperty(payload, "id");
            Assert.Equal("SuperAdministrator", GetStringFromProperty(payload, "role"));
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("branchId").ValueKind);
        }

        foreach (var isActive in new[] { false, true })
        {
            using var updateResponse = await PutJsonAsync(
                client,
                $"/users/{superAdministratorId}",
                new
                {
                    FullName = "HeadCoach created SA",
                    Login = login,
                    Role = "SuperAdministrator",
                    MustChangePassword = false,
                    IsActive = isActive,
                    BranchId = (Guid?)null
                },
                session.CsrfToken);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            Assert.Equal(
                isActive,
                (await ReadJsonElementAsync(updateResponse)).GetProperty("isActive").GetBoolean());
        }

        using (var forbiddenTransitionResponse = await PutJsonAsync(
                   client,
                   $"/users/{superAdministratorId}",
                   new
                   {
                       FullName = "HeadCoach created SA",
                       Login = login,
                       Role = "Coach",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenTransitionResponse.StatusCode);
            await AssertProblemDetailsAsync(
                forbiddenTransitionResponse,
                "/problems/staff-role-transition-forbidden",
                "staff_role_transition_forbidden");
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var user = await dbContext.Users.SingleAsync(candidate => candidate.Id == superAdministratorId);
        var auditLogs = await dbContext.AuditLogs
            .Where(log => log.EntityType == "User" && log.EntityId == superAdministratorId.ToString())
            .ToListAsync();

        Assert.Equal(UserRole.SuperAdministrator, user.Role);
        Assert.Null(user.BranchId);
        Assert.True(user.IsActive);
        Assert.Equal(3, auditLogs.Count);
        Assert.All(auditLogs, log => Assert.Equal(seeded.HeadCoachId, log.UserId));
    }

    [Fact]
    public async Task SuperAdministrator_can_create_and_update_branch_staff_with_exact_audit_scope()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);

        using (var listResponse = await client.GetAsync("/users"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var payload = await ReadJsonElementAsync(listResponse);
            Assert.Equal(
                ["Administrator", "Coach"],
                payload.GetProperty("createRoleOptions")
                    .EnumerateArray()
                    .Select(item => item.GetString()!)
                    .ToArray());

            var items = payload.GetProperty("items").EnumerateArray().ToArray();
            var headCoach = items.Single(item => GetGuidFromProperty(item, "id") == seeded.HeadCoachId);
            var peerSuperAdministrator = items.Single(
                item => GetGuidFromProperty(item, "id") == seeded.PeerSuperAdministratorId);
            var administrator = items.Single(
                item => GetGuidFromProperty(item, "id") == seeded.AdministratorId);

            Assert.Empty(headCoach.GetProperty("allowedActions").EnumerateArray());
            Assert.Empty(peerSuperAdministrator.GetProperty("allowedActions").EnumerateArray());
            Assert.Equal(
                ["Edit", "Deactivate", "Reactivate"],
                administrator.GetProperty("allowedActions")
                    .EnumerateArray()
                    .Select(item => item.GetString()!)
                    .ToArray());
            Assert.Equal(
                ["Administrator"],
                administrator.GetProperty("roleOptions")
                    .EnumerateArray()
                    .Select(item => item.GetString()!)
                    .ToArray());
        }

        var administratorLogin = $"sa-happy-admin-{Guid.NewGuid():N}";
        Guid administratorId;
        using (var createAdministratorResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "SA Happy Administrator",
                       Login = administratorLogin,
                       Password = "12345Aa!",
                       Role = "Administrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createAdministratorResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createAdministratorResponse);
            administratorId = GetGuidFromProperty(payload, "id");
            Assert.Equal(seeded.SecondBranchId, GetGuidFromProperty(payload, "branchId"));
            Assert.Equal(["Administrator"], payload.GetProperty("roleOptions")
                .EnumerateArray()
                .Select(item => item.GetString()!)
                .ToArray());
        }

        using (var createCoachResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "SA Happy Coach",
                       Login = $"sa-happy-coach-{Guid.NewGuid():N}",
                       Password = "12345Aa!",
                       Role = "Coach",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createCoachResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createCoachResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("branchId").ValueKind);
            Assert.Equal(["Coach"], payload.GetProperty("roleOptions")
                .EnumerateArray()
                .Select(item => item.GetString()!)
                .ToArray());
        }

        using (var updateAdministratorResponse = await PutJsonAsync(
                   client,
                   $"/users/{administratorId}",
                   new
                   {
                       FullName = "SA Happy Administrator moved",
                       Login = administratorLogin,
                       Role = "Administrator",
                       MustChangePassword = true,
                       IsActive = false,
                       BranchId = seeded.BranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateAdministratorResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateAdministratorResponse);
            Assert.Equal(seeded.BranchId, GetGuidFromProperty(payload, "branchId"));
            Assert.False(payload.GetProperty("isActive").GetBoolean());
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var administratorAudit = await dbContext.AuditLogs
            .Where(log => log.EntityType == "User" && log.EntityId == administratorId.ToString())
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        Assert.Equal(2, administratorAudit.Count);
        Assert.All(administratorAudit, log => Assert.Equal(seeded.SuperAdministratorId, log.UserId));
        Assert.Equal("UserCreated", administratorAudit[0].ActionType);
        Assert.Equal("UserUpdated", administratorAudit[1].ActionType);
        AssertAuditState(administratorAudit[0].NewValueJson, "Administrator", seeded.SecondBranchId);
        AssertAuditState(administratorAudit[1].OldValueJson, "Administrator", seeded.SecondBranchId);
        AssertAuditState(administratorAudit[1].NewValueJson, "Administrator", seeded.BranchId);
        AssertNoPasswordInAuditState(administratorAudit[0].NewValueJson);
        AssertNoPasswordInAuditState(administratorAudit[1].NewValueJson);
    }

    [Fact]
    public async Task Archived_branch_assignment_is_preserved_but_cannot_be_created_or_reassigned()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        var assignedLogin = $"archived-assigned-{Guid.NewGuid():N}";
        Guid assignedUserId;

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "Archived assigned administrator",
                       Login = assignedLogin,
                       Password = "12345Aa!",
                       Role = "Administrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            assignedUserId = GetGuidFromProperty(await ReadJsonElementAsync(createResponse), "id");
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/branches/{seeded.SecondBranchId}/archive",
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        }

        using (var preserveResponse = await PutJsonAsync(
                   client,
                   $"/users/{assignedUserId}",
                   new
                   {
                       FullName = "Archived assigned administrator updated",
                       Login = assignedLogin,
                       Role = "Administrator",
                       MustChangePassword = true,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, preserveResponse.StatusCode);
            Assert.Equal(
                seeded.SecondBranchId,
                GetGuidFromProperty(await ReadJsonElementAsync(preserveResponse), "branchId"));
        }

        int userCountBeforeDenials;
        int auditCountBeforeDenials;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            userCountBeforeDenials = await dbContext.Users.CountAsync();
            auditCountBeforeDenials = await dbContext.AuditLogs.CountAsync(log => log.EntityType == "User");
        }

        using (var createOnArchivedResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "New archived administrator",
                       Login = $"new-archived-{Guid.NewGuid():N}",
                       Password = "12345Aa!",
                       Role = "Administrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(createOnArchivedResponse);
            AssertHasError(errors, "branchId");
        }

        using (var reassignToArchivedResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.AdministratorId}",
                   new
                   {
                       FullName = "Администратор Stage 4",
                       Login = seeded.AdministratorLogin,
                       Role = "Administrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(reassignToArchivedResponse);
            AssertHasError(errors, "branchId");
        }

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(userCountBeforeDenials, await verificationDb.Users.CountAsync());
        Assert.Equal(
            auditCountBeforeDenials,
            await verificationDb.AuditLogs.CountAsync(log => log.EntityType == "User"));
        Assert.Equal(
            seeded.BranchId,
            await verificationDb.Users
                .Where(user => user.Id == seeded.AdministratorId)
                .Select(user => user.BranchId)
                .SingleAsync());
        Assert.Equal(
            seeded.SecondBranchId,
            await verificationDb.Users
                .Where(user => user.Id == assignedUserId)
                .Select(user => user.BranchId)
                .SingleAsync());
    }

    [Fact]
    public async Task SuperAdministrator_can_create_and_update_administrator_through_settings_transport()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        var login = $"settings-sa-admin-{Guid.NewGuid():N}";
        Guid administratorId;

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/settings/administrators",
                   new
                   {
                       FullName = "Settings SA Administrator",
                       Login = login,
                       Password = "12345Aa!",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = seeded.SecondBranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createResponse);
            administratorId = GetGuidFromProperty(payload, "id");
            Assert.Equal("Administrator", GetStringFromProperty(payload, "role"));
            Assert.Equal(seeded.SecondBranchId, GetGuidFromProperty(payload, "branchId"));
            Assert.Equal(["Administrator"], payload.GetProperty("roleOptions")
                .EnumerateArray()
                .Select(item => item.GetString()!)
                .ToArray());
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/settings/administrators/{administratorId}",
                   new
                   {
                       FullName = "Settings SA Administrator moved",
                       Login = login,
                       MustChangePassword = true,
                       IsActive = false,
                       BranchId = seeded.BranchId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal(seeded.BranchId, GetGuidFromProperty(payload, "branchId"));
            Assert.False(payload.GetProperty("isActive").GetBoolean());
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var auditLogs = await dbContext.AuditLogs
            .Where(log => log.EntityType == "User" && log.EntityId == administratorId.ToString())
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        Assert.Equal(2, auditLogs.Count);
        Assert.All(auditLogs, log => Assert.Equal(seeded.SuperAdministratorId, log.UserId));
        AssertAuditState(auditLogs[0].NewValueJson, "Administrator", seeded.SecondBranchId);
        AssertAuditState(auditLogs[1].OldValueJson, "Administrator", seeded.SecondBranchId);
        AssertAuditState(auditLogs[1].NewValueJson, "Administrator", seeded.BranchId);
    }

    [Fact]
    public async Task Empty_and_unknown_administrator_branch_are_rejected_without_mutation_or_audit()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        int userCountBefore;
        int auditCountBefore;
        DateTimeOffset administratorUpdatedAt;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            userCountBefore = await dbContext.Users.CountAsync();
            auditCountBefore = await dbContext.AuditLogs.CountAsync(log => log.EntityType == "User");
            administratorUpdatedAt = await dbContext.Users
                .Where(user => user.Id == seeded.AdministratorId)
                .Select(user => user.UpdatedAt)
                .SingleAsync();
        }

        foreach (var branchId in new[] { Guid.Empty, Guid.NewGuid() })
        {
            using var response = await PostJsonAsync(
                client,
                "/users",
                new
                {
                    FullName = "Invalid branch administrator",
                    Login = $"invalid-branch-{Guid.NewGuid():N}",
                    Password = "12345Aa!",
                    Role = "Administrator",
                    MustChangePassword = false,
                    IsActive = true,
                    BranchId = branchId
                },
                session.CsrfToken);
            var errors = await ReadValidationErrorsAsync(response);
            AssertHasError(errors, "branchId");
        }

        using (var response = await PutJsonAsync(
                   client,
                   $"/users/{seeded.AdministratorId}",
                   new
                   {
                       FullName = "Administrator invalid move",
                       Login = seeded.AdministratorLogin,
                       Role = "Administrator",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = Guid.NewGuid()
                   },
                   session.CsrfToken))
        {
            var errors = await ReadValidationErrorsAsync(response);
            AssertHasError(errors, "branchId");
        }

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(userCountBefore, await verificationDb.Users.CountAsync());
        Assert.Equal(
            auditCountBefore,
            await verificationDb.AuditLogs.CountAsync(log => log.EntityType == "User"));
        var administrator = await verificationDb.Users.SingleAsync(user => user.Id == seeded.AdministratorId);
        Assert.Equal("Администратор Stage 4", administrator.FullName);
        Assert.Equal(seeded.BranchId, administrator.BranchId);
        Assert.Equal(administratorUpdatedAt, administrator.UpdatedAt);
    }

    [Fact]
    public async Task Mandatory_staff_audit_insert_failure_rolls_back_create_and_update_on_relational_provider()
    {
        await using var factory = new UsersAppFactory(useSqlite: true);
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            await dbContext.Database.ExecuteSqlRawAsync(
                """
                CREATE TRIGGER "FailMandatoryUserAudit"
                BEFORE INSERT ON "AuditLogs"
                WHEN NEW."EntityType" = 'User'
                BEGIN
                    SELECT RAISE(ABORT, 'Mandatory user audit failed for test');
                END;
                """);
        }

        var createLogin = $"rollback-user-{Guid.NewGuid():N}";
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/users",
                   new
                   {
                       FullName = "Rollback create",
                       Login = createLogin,
                       Password = "12345Aa!",
                       Role = "Coach",
                       MustChangePassword = false,
                       IsActive = true,
                       BranchId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.InternalServerError, createResponse.StatusCode);
        }

        DateTimeOffset coachUpdatedAt;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.False(await dbContext.Users.AnyAsync(user => user.Login == createLogin));
            Assert.False(await dbContext.AuditLogs.AnyAsync(
                log => log.EntityType == "User" && log.Description.Contains(createLogin)));
            coachUpdatedAt = await dbContext.Users
                .Where(user => user.Id == seeded.CoachId)
                .Select(user => user.UpdatedAt)
                .SingleAsync();
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/users/{seeded.CoachId}",
                   new
                   {
                       FullName = "Rollback update",
                       Login = seeded.CoachLogin,
                       Role = "Coach",
                       MustChangePassword = true,
                       IsActive = false,
                       BranchId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.InternalServerError, updateResponse.StatusCode);
        }

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var coach = await verificationDb.Users.SingleAsync(user => user.Id == seeded.CoachId);
        Assert.Equal("Тренер Stage 4", coach.FullName);
        Assert.False(coach.MustChangePassword);
        Assert.True(coach.IsActive);
        Assert.Equal(coachUpdatedAt, coach.UpdatedAt);
        Assert.False(await verificationDb.AuditLogs.AnyAsync(
            log => log.EntityType == "User" && log.EntityId == seeded.CoachId.ToString()));
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
                   new UserUpdateRequest("Аудит пользователь v2", createLogin, "Coach", true, false),
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
        var superAdministrator = CreateUser("super-administrator-stage4", "Суперадминистратор Stage 4", UserRole.SuperAdministrator, sharedPassword, now, passwordHashService);
        var peerSuperAdministrator = CreateUser("peer-super-administrator-stage4", "Другой суперадминистратор Stage 4", UserRole.SuperAdministrator, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage4", "Администратор Stage 4", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage4", "Тренер Stage 4", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Users API Branch",
            Address = "Users API address",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var secondBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Users API Second Branch",
            Address = "Users API second address",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = branch.Id;

        dbContext.Users.AddRange(headCoach, superAdministrator, peerSuperAdministrator, administrator, coach);
        dbContext.Branches.AddRange(branch, secondBranch);
        await dbContext.SaveChangesAsync();

        return new SeededUsersData(
            headCoach.Id,
            superAdministrator.Id,
            peerSuperAdministrator.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            superAdministrator.Login,
            peerSuperAdministrator.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            branch.Id,
            secondBranch.Id);
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

    private static Guid GetGuidFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            Guid.TryParse(property.GetString(), out var value)
            ? value
            : Guid.Empty;
    }

    private static string GetStringFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.GetString() is { } value
            ? value
            : string.Empty;
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

    private static async Task AssertProblemDetailsAsync(
        HttpResponseMessage response,
        string expectedType,
        string expectedCode)
    {
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(expectedType, payload.GetProperty("type").GetString());
        Assert.Equal(expectedCode, payload.GetProperty("code").GetString());
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

    private static void AssertAuditState(
        string? jsonPayload,
        string expectedRole,
        Guid? expectedBranchId)
    {
        Assert.False(string.IsNullOrWhiteSpace(jsonPayload));
        using var document = JsonDocument.Parse(jsonPayload);
        var payload = document.RootElement;

        Assert.Equal(expectedRole, payload.GetProperty("role").GetString());
        if (expectedBranchId.HasValue)
        {
            Assert.Equal(expectedBranchId.Value, payload.GetProperty("branchId").GetGuid());
        }
        else
        {
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("branchId").ValueKind);
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
        Guid SuperAdministratorId,
        Guid PeerSuperAdministratorId,
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string PeerSuperAdministratorLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid BranchId,
        Guid SecondBranchId);

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
        bool CanManageSettings,
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

    private sealed class UsersAppFactory(bool useSqlite = false) : WebApplicationFactory<Program>
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
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();

                if (useSqlite)
                {
                    var sqliteProvider = new ServiceCollection()
                        .AddEntityFrameworkSqlite()
                        .BuildServiceProvider();
                    var connection = new SqliteConnection("Data Source=:memory:");
                    connection.Open();
                    connection.CreateFunction<string?, string?>(
                        "btrim",
                        value => value?.Trim(),
                        isDeterministic: true);
                    connection.CreateFunction<string?, int>(
                        "cardinality",
                        value => string.IsNullOrWhiteSpace(value)
                            ? 0
                            : JsonDocument.Parse(value).RootElement.GetArrayLength(),
                        isDeterministic: true);
                    var bootstrapOptions = new DbContextOptionsBuilder<GymCrmDbContext>()
                        .UseSqlite(connection)
                        .UseInternalServiceProvider(sqliteProvider)
                        .Options;
                    using (var bootstrapContext = new GymCrmDbContext(bootstrapOptions))
                    {
                        bootstrapContext.Database.EnsureCreated();
                    }

                    services.AddSingleton(connection);
                    services.AddDbContext<GymCrmDbContext>((serviceProvider, options) =>
                        options
                            .UseSqlite(serviceProvider.GetRequiredService<SqliteConnection>())
                            .UseInternalServiceProvider(sqliteProvider));
                }
                else
                {
                    var databaseName = $"gym-crm-users-tests-{Guid.NewGuid():N}";
                    var entityFrameworkProvider = new ServiceCollection()
                        .AddEntityFrameworkInMemoryDatabase()
                        .BuildServiceProvider();

                    services.AddDbContext<GymCrmDbContext>(options =>
                        options
                            .UseInMemoryDatabase(databaseName)
                            .UseInternalServiceProvider(entityFrameworkProvider));
                }
            });
        }
    }
}
