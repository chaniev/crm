using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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

public class ClientsApiTests
{
    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_client_lifecycle(string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
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

        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "Иванов",
                FirstName = "Иван",
                MiddleName = (string?)null,
                Phone = "+79990001122",
                Contacts = new[]
                {
                    new
                    {
                        Type = "Мама",
                        FullName = "Иванова Мария",
                        Phone = "+79990001123"
                    }
                },
                GroupIds = new[] { seeded.GroupOneId, seeded.GroupTwoId }
            },
            actorSession.CsrfToken);

        Assert.True(
            createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"Expected client create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        var clientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);

        using (var listResponse = await client.GetAsync("/clients?page=1&pageSize=1&status=Active"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");
            Assert.Equal(1, clientsPayload.GetArrayLength());
            Assert.Equal(clientId, GetGuidFromProperty(clientsPayload[0], "id"));
        }

        using (var getResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var getPayload = await ReadJsonElementAsync(getResponse);
            Assert.Equal(clientId, GetGuidFromProperty(getPayload, "id"));
            Assert.Equal("Иванов Иван", GetStringFromProperty(getPayload, "fullName"));
            Assert.Equal("+79990001122", GetStringFromProperty(getPayload, "phone"));
            var groupsPayload = GetArrayPayload(getPayload.GetProperty("groups"));
            Assert.Equal(2, groupsPayload.GetArrayLength());
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{clientId}",
                   new
                   {
                       LastName = "",
                       FirstName = "Мария",
                       MiddleName = "Ивановна",
                       Phone = "+79990001199",
                       Contacts = new[]
                       {
                           new
                           {
                               Type = "Мама",
                               FullName = "Иванова Мария",
                               Phone = "+79990001200"
                           },
                           new
                           {
                               Type = "Папа",
                               FullName = "Иванов Петр",
                               Phone = "+79990001201"
                           }
                       },
                       GroupIds = new[] { seeded.GroupTwoId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updatePayload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal("Мария Ивановна", GetStringFromProperty(updatePayload, "fullName"));
            Assert.Equal("Active", GetStringFromProperty(updatePayload, "status"));
            Assert.Equal(2, GetArrayPayload(updatePayload.GetProperty("contacts")).GetArrayLength());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var persistedClient = await dbContext.Clients
                .Include(candidate => candidate.Contacts)
                .Include(candidate => candidate.Groups)
                .SingleAsync(candidate => candidate.Id == clientId);

            Assert.Equal("+79990001199", persistedClient.Phone);
            Assert.Equal(2, persistedClient.Contacts.Count);
            Assert.Equal(new[] { seeded.GroupTwoId }, persistedClient.Groups.Select(group => group.GroupId).ToArray());
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{clientId}/archive",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
            var archivePayload = await ReadJsonElementAsync(archiveResponse);
            Assert.Equal("Archived", GetStringFromProperty(archivePayload, "status"));
        }

        using (var archivedListResponse = await client.GetAsync("/clients?isArchived=true"))
        {
            Assert.Equal(HttpStatusCode.OK, archivedListResponse.StatusCode);
            var archivedListPayload = await ReadJsonElementAsync(archivedListResponse);
            var archivedClients = GetArrayPayload(archivedListPayload, "data", "items", "clients");
            Assert.Contains(
                archivedClients.EnumerateArray(),
                item => GetGuidFromProperty(item, "id") == clientId);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{clientId}/restore",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
            var restorePayload = await ReadJsonElementAsync(restoreResponse);
            Assert.Equal("Active", GetStringFromProperty(restorePayload, "status"));
        }
    }

    [Fact]
    public async Task Coach_cannot_access_clients_management_endpoints()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", actorSession.User?.Role);

        using (var listResponse = await client.GetAsync("/clients"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        }

        using (var getResponse = await client.GetAsync($"/clients/{seeded.ArchivedClientId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       FirstName = "Forbidden",
                       Phone = "+79990008888",
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}",
                   new
                   {
                       FirstName = "Forbidden",
                       Phone = "+79990008888",
                       GroupIds = Array.Empty<Guid>()
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}/archive",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, archiveResponse.StatusCode);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}/restore",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, restoreResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Client_create_validates_required_fields_contact_limit_and_groups()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "",
                FirstName = "",
                MiddleName = "",
                Phone = "",
                Contacts = new object[]
                {
                    new
                    {
                        Type = "",
                        FullName = "",
                        Phone = ""
                    },
                    new
                    {
                        Type = "Папа",
                        FullName = "Иванов Петр",
                        Phone = "+79990001201"
                    },
                    new
                    {
                        Type = "Опекун",
                        FullName = "Сидоров Сергей",
                        Phone = "+79990001202"
                    }
                },
                GroupIds = new[] { Guid.NewGuid() }
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, createResponse.StatusCode);

        var validationPayload = await ReadJsonElementAsync(createResponse);
        var errorsPayload = validationPayload.GetProperty("errors");

        Assert.True(errorsPayload.TryGetProperty("phone", out _));
        Assert.True(errorsPayload.TryGetProperty("fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].type", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].phone", out _));
        Assert.True(errorsPayload.TryGetProperty("groupIds", out _));
    }

    [Fact]
    public async Task Client_audit_entries_are_append_only_and_no_sensitive_data()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var operationStartedAt = DateTimeOffset.UtcNow;

        Guid createdClientId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       LastName = "Audit",
                       FirstName = "Client",
                       Phone = "+79990001300",
                       Contacts = Array.Empty<object>(),
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   session.CsrfToken))
        {
            Assert.True(createResponse.IsSuccessStatusCode);
            var createPayload = await ReadJsonElementAsync(createResponse);
            createdClientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{createdClientId}",
                   new
                   {
                       LastName = "Audit",
                       FirstName = "Updated",
                       MiddleName = "Client",
                       Phone = "+79990001301",
                       Contacts = new[]
                       {
                           new
                           {
                               Type = "Мама",
                               FullName = "Аудит Мария",
                               Phone = "+79990001302"
                           }
                       },
                       GroupIds = new[] { seeded.GroupTwoId }
                   },
                   session.CsrfToken))
        {
            Assert.True(updateResponse.IsSuccessStatusCode);
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{createdClientId}/archive",
                   session.CsrfToken))
        {
            Assert.True(archiveResponse.IsSuccessStatusCode);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{createdClientId}/restore",
                   session.CsrfToken))
        {
            Assert.True(restoreResponse.IsSuccessStatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var auditLogs = await dbContext.AuditLogs
            .Where(log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        Assert.Contains(auditLogs, log => log.ActionType == "ClientCreated");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientUpdated");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientArchived");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientRestored");

        foreach (var log in auditLogs)
        {
            AssertNoPasswordInAuditState(log.OldValueJson);
            AssertNoPasswordInAuditState(log.NewValueJson);
        }
    }

    private static async Task<SeededClientsData> SeedClientsDataAsync(ClientsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage6a-password";

        var headCoach = CreateUser("headcoach-stage6a", "Главный тренер Stage 6a", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage6a", "Администратор Stage 6a", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage6a", "Тренер Stage 6a", UserRole.Coach, sharedPassword, now, passwordHashService);

        var groupOne = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group One",
            TrainingStartTime = new TimeOnly(9, 0),
            ScheduleText = "Пн-Ср-Пт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var groupTwo = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group Two",
            TrainingStartTime = new TimeOnly(18, 30),
            ScheduleText = "Вт-Чт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var archivedClient = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "Архивный",
            FirstName = "Клиент",
            Phone = "+79990001000",
            Status = ClientStatus.Archived,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.TrainingGroups.AddRange(groupOne, groupTwo);
        dbContext.Clients.Add(archivedClient);
        await dbContext.SaveChangesAsync();

        return new SeededClientsData(
            headCoach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            groupOne.Id,
            groupTwo.Id,
            archivedClient.Id);
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

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static async Task<Guid> ExtractClientIdFromResponseAsync(
        HttpResponseMessage response,
        JsonElement responsePayload)
    {
        if (TryGetGuid(responsePayload, "Id", out var clientId))
        {
            return clientId;
        }

        if (TryGetGuid(responsePayload, "id", out clientId))
        {
            return clientId;
        }

        if (response.Headers.Location is { } location &&
            Guid.TryParse(location.Segments.LastOrDefault(), out var idFromLocation))
        {
            return idFromLocation;
        }

        Assert.Fail("Client id not present in create response.");
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

    private sealed record SeededClientsData(
        Guid HeadCoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid GroupOneId,
        Guid GroupTwoId,
        Guid ArchivedClientId);

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

    private sealed class ClientsAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-stage6a",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 6a"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-clients-tests-{Guid.NewGuid():N}";
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
