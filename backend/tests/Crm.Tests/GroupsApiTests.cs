using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Crm.Application.Security;
using Crm.Domain.Clients;
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

public class GroupsApiTests
{
    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_group_and_assign_trainers(string actorRole)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole == "HeadCoach"
            ? seeded.HeadCoachLogin
            : seeded.AdministratorLogin;

        var actorSession = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        Assert.Equal(actorRole, actorSession.User?.Role);

        var groupName = $"Group {Guid.NewGuid():N}";
        using var createResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                Name = groupName,
                TrainingStartTime = "18:00:00",
                ScheduleText = "Вт-Чт-Пт",
                IsActive = true
            },
            actorSession.CsrfToken);
        Assert.True(
            createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"Expected group create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        var groupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);

        using (var listResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var groupsPayload = GetArrayPayload(listPayload, "data", "items", "groups");
            var hasCreatedGroup = groupsPayload.EnumerateArray().Any(item => GetGuidFromProperty(item, "id") == groupId);
            Assert.True(hasCreatedGroup);
        }

        using (var getResponse = await client.GetAsync($"/groups/{groupId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var getPayload = await ReadJsonElementAsync(getResponse);
            Assert.Equal(groupId, GetGuidFromProperty(getPayload, "id"));
            Assert.Equal(groupName, GetStringFromProperty(getPayload, "name"));
        }

        var updatePayload = new
        {
            Name = "Group Updated",
            TrainingStartTime = "19:00:00",
            ScheduleText = "Пн-Ср",
            IsActive = true
        };
        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{groupId}",
                   updatePayload,
                   actorSession.CsrfToken))
        {
            Assert.True(
                updateResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent,
                $"Expected group update success, got {updateResponse.StatusCode}.");
        }

        using (var assignResponse = await AssignTrainersToGroupAsync(
                   client,
                   $"/groups/{groupId}",
                   groupId,
                   new[] { seeded.CoachOneId, seeded.CoachTwoId },
                   actorSession.CsrfToken))
        {
            Assert.True(
                assignResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent or HttpStatusCode.Created,
                $"Expected trainer assignment success, got {assignResponse.StatusCode}.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var assignedGroup = await dbContext.GroupTrainers
                .Where(gt => gt.GroupId == groupId)
                .Select(gt => gt.TrainerId)
                .OrderBy(id => id)
                .ToListAsync();

            Assert.Equal(
                new[] { seeded.CoachOneId, seeded.CoachTwoId }.OrderBy(id => id).ToArray(),
                assignedGroup);
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{groupId}/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clientsArray = GetArrayPayload(clientsPayload, "data", "items", "clients");
            Assert.Equal(0, clientsArray.GetArrayLength());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var clientEntity = await CreateClientEntityAsync(dbContext, seeded.Now);
            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientEntity.Id,
                GroupId = groupId
            });
            await dbContext.SaveChangesAsync();
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{groupId}/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clientsArray = GetArrayPayload(clientsPayload, "data", "items", "clients");
            Assert.Equal(1, clientsArray.GetArrayLength());
        }
    }

    [Fact]
    public async Task Coach_cannot_access_groups_management_endpoints()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);

        Assert.Equal("Coach", actorSession.User?.Role);

        using (var listResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        }

        using (var getResponse = await client.GetAsync($"/groups/{seeded.GroupOneId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/groups",
                   new
                   {
                       Name = "Coach attempt",
                       TrainingStartTime = "18:00:00",
                       ScheduleText = "Вт-Чт",
                       IsActive = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{seeded.GroupOneId}",
                   new
                   {
                       Name = "Forbidden update",
                       TrainingStartTime = "18:30:00",
                       ScheduleText = "Пн-Пт",
                       IsActive = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{seeded.GroupOneId}/clients"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, clientsResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Group_create_and_update_audit_entries_are_append_only_and_no_sensitive_data()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var operationStartedAt = DateTimeOffset.UtcNow;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var initialAuditCount = await dbContext.AuditLogs.CountAsync(
                log => log.UserId == seeded.HeadCoachId &&
                    log.CreatedAt >= operationStartedAt);
            Assert.Equal(0, initialAuditCount);
        }

        using var createResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                Name = $"Audit group {Guid.NewGuid():N}",
                TrainingStartTime = "07:00:00",
                ScheduleText = "Пн",
                IsActive = true
            },
            session.CsrfToken);

        Assert.True(createResponse.IsSuccessStatusCode);

        var createPayload = await ReadJsonElementAsync(createResponse);
        var createdGroupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var midAudit = await dbContext.AuditLogs.Where(
                    log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();
            Assert.NotEmpty(midAudit);
            foreach (var log in midAudit)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{createdGroupId}",
                   new
                   {
                       Name = "Audit group updated",
                       TrainingStartTime = "08:00:00",
                       ScheduleText = "Вт",
                       IsActive = true
                   },
                   session.CsrfToken))
        {
            Assert.True(updateResponse.IsSuccessStatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var finalAudit = await dbContext.AuditLogs
                .Where(log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();

            Assert.True(finalAudit.Count >= 2);

            foreach (var log in finalAudit)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }
        }
    }

    [Fact]
    public async Task Coach_session_reflects_assigned_group_after_group_assignment()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        Guid createdGroupId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/groups",
                   new
                   {
                       Name = "Coach Session Group",
                       TrainingStartTime = "12:00:00",
                       ScheduleText = "Пн-Ср-Пт",
                       IsActive = true
                   },
                   managerSession.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected group create success, got {createResponse.StatusCode}.");
            var createPayload = await ReadJsonElementAsync(createResponse);
            createdGroupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            var createdGroup = await dbContext.TrainingGroups.SingleAsync(g => g.Name == "Coach Session Group");
            await AssignCoachesToGroupDirectlyAsync(dbContext, createdGroup.Id, new[] { seeded.CoachOneId });
            await dbContext.SaveChangesAsync();
        }

        var coachSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Contains(createdGroupId.ToString(), coachSession.User?.AssignedGroupIds ?? Array.Empty<string>());

        var accessAssigned = await PostWithoutBodyAsync(
            client,
            $"/access/attendance/{createdGroupId}",
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, accessAssigned.StatusCode);

        var accessUnassigned = await PostWithoutBodyAsync(
            client,
            $"/access/attendance/{seeded.GroupOneId}",
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, accessUnassigned.StatusCode);
    }

    private static async Task<SeededGroupsData> SeedGroupsDataAsync(GroupsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage5-password";

        var headCoach = CreateUser("headcoach-stage5", "Главный тренер Stage 5", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage5", "Администратор Stage 5", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coachOne = CreateUser("coach-one-stage5", "Тренер 1 Stage 5", UserRole.Coach, sharedPassword, now, passwordHashService);
        var coachTwo = CreateUser("coach-two-stage5", "Тренер 2 Stage 5", UserRole.Coach, sharedPassword, now, passwordHashService);

        var groupOne = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Existing coach-visible group",
            TrainingStartTime = new TimeOnly(9, 0),
            ScheduleText = "Вт,Чт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coachOne, coachTwo);
        dbContext.TrainingGroups.Add(groupOne);
        await dbContext.SaveChangesAsync();

        return new SeededGroupsData(
            headCoach.Id,
            administrator.Id,
            coachOne.Id,
            coachTwo.Id,
            headCoach.Login,
            administrator.Login,
            coachOne.Login,
            sharedPassword,
            groupOne.Id,
            now);
    }

    private static async Task<Client> CreateClientEntityAsync(CrmDbContext dbContext, DateTimeOffset now)
    {
        var client = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "Фамилия",
            FirstName = "Имя",
            Phone = $"+7999000{new Random().Next(100, 999)}",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync();
        return client;
    }

    private static async Task AssignCoachesToGroupDirectlyAsync(
        CrmDbContext dbContext,
        Guid groupId,
        IReadOnlyList<Guid> coachIds)
    {
        foreach (var coachId in coachIds)
        {
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = groupId,
                TrainerId = coachId
            });
        }

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

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
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

    private static async Task<Guid> ExtractGroupIdFromResponseAsync(
        HttpResponseMessage response,
        JsonElement responsePayload)
    {
        if (TryGetGuid(responsePayload, "Id", out var groupId))
        {
            return groupId;
        }

        if (TryGetGuid(responsePayload, "id", out groupId))
        {
            return groupId;
        }

        if (response.Headers.Location is { } location &&
            Guid.TryParse(location.Segments.LastOrDefault(), out var idFromLocation))
        {
            return idFromLocation;
        }

        Assert.Fail("Group id not present in create response.");
        return Guid.Empty;
    }

    private static JsonElement GetArrayPayload(JsonElement payload, params string[] alternativeNames)
    {
        if (payload.ValueKind == JsonValueKind.Array)
        {
            return payload;
        }

        foreach (var alternativeName in alternativeNames)
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty(alternativeName, out var data) &&
                data.ValueKind == JsonValueKind.Array)
            {
                return data;
            }
        }

        return payload;
    }

    private static bool TryGetGuid(JsonElement payload, string propertyName, out Guid value)
    {
        if (payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            Guid.TryParse(property.GetString(), out value))
        {
            return true;
        }

        value = Guid.Empty;
        return false;
    }

    private static Guid GetGuidFromProperty(JsonElement payload, string propertyName)
    {
        return TryGetGuid(payload, propertyName, out var value) ? value : Guid.Empty;
    }

    private static string GetStringFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.GetString() is { } value
            ? value
            : string.Empty;
    }

    private static async Task<HttpResponseMessage> AssignTrainersToGroupAsync(
        HttpClient client,
        string groupEndpointBase,
        Guid groupId,
        IReadOnlyList<Guid> trainerIds,
        string csrfToken)
    {
        var trainerPayload = new
        {
            TrainerIds = trainerIds
        };

        var dedicatedAssignResponse = await PutJsonAsync(
            client,
            $"{groupEndpointBase}/trainers",
            trainerPayload,
            csrfToken);

        if (dedicatedAssignResponse.StatusCode is not HttpStatusCode.NotFound)
        {
            return dedicatedAssignResponse;
        }

        dedicatedAssignResponse.Dispose();

        var fullPayload = new
        {
            TrainerIds = trainerIds
        };

        return await PutJsonAsync(
            client,
            $"/groups/{groupId}",
            fullPayload,
            csrfToken);
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

    private static void AssertNoPasswordInAuditState(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return;
        }

        Assert.False(ContainsPasswordFieldInJson(payload), "Audit log payload contains password fields.");
    }

    private sealed record SeededGroupsData(
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachOneId,
        Guid CoachTwoId,
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid GroupOneId,
        DateTimeOffset Now);

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

    private sealed class GroupsAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=crm;Username=crm;Password=crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage5",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 5"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<CrmDbContext>>();
                services.RemoveAll<CrmDbContext>();

                var databaseName = $"crm-groups-tests-{Guid.NewGuid():N}";
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
