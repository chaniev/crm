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

public class AttendanceApiTests
{
    // Принятые контрактные допущения (этап 7):
    // 1) Список доступных групп для отметки: GET /attendance/groups
    // 2) Список клиентов на дату: GET /attendance/groups/{groupId}/clients?trainingDate=yyyy-MM-dd
    // 3) Сохранение/редактирование отметок: POST /attendance/groups/{groupId}
    // 4) Тело отправки: { trainingDate, attendanceMarks: [{ clientId, isPresent }] }

    [Fact]
    public async Task HeadCoach_can_mark_attendance_edit_it_and_trigger_single_visit_write_off()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        Assert.Equal("HeadCoach", session.User?.Role);

        var trainingDate = DateTimeOffset.UtcNow.Date;
        var trainingDateString = trainingDate.ToString("yyyy-MM-dd");

        using var clientsResponse = await client.GetAsync(
            $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={trainingDateString}");
        var clientsResponseBody = await clientsResponse.Content.ReadAsStringAsync();
        Assert.True(
            clientsResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {clientsResponse.StatusCode}. Body: {clientsResponseBody}");

        var clientsPayload = await ReadJsonElementAsync(clientsResponse);
        var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
        var targetClient = FindById(clients, seeded.SingleVisitClientId);
        Assert.False(targetClient.ValueKind == JsonValueKind.Undefined);

        using var firstSaveResponse = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = trainingDateString,
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        IsPresent = false
                    }
                }
            },
            session.CsrfToken);
        Assert.True(firstSaveResponse.IsSuccessStatusCode);

        using var secondSaveResponse = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = trainingDateString,
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        IsPresent = true
                    }
                }
            },
            session.CsrfToken);
        Assert.True(secondSaveResponse.IsSuccessStatusCode);

        var operationStartedAt = DateTimeOffset.UtcNow.AddMinutes(-5);
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var attendanceDate = DateOnly.FromDateTime(trainingDate);
        var attendance = await dbContext.Attendance.SingleAsync(
            mark => mark.ClientId == seeded.SingleVisitClientId &&
                mark.GroupId == seeded.AssignedGroupId &&
                mark.TrainingDate == attendanceDate,
            cancellationToken: default);

        Assert.True(attendance.IsPresent);
        Assert.Equal(seeded.HeadCoachId, attendance.MarkedByUserId);

        var currentMembership = await dbContext.ClientMemberships.SingleAsync(
            membership => membership.ClientId == seeded.SingleVisitClientId &&
                membership.ValidTo == null,
            cancellationToken: default);

        Assert.True(currentMembership.SingleVisitUsed);

        var attendanceAuditEntries = await dbContext.AuditLogs
            .Where(log =>
                log.UserId == seeded.HeadCoachId &&
                log.EntityType == "Attendance" &&
                log.CreatedAt >= operationStartedAt)
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        Assert.NotEmpty(attendanceAuditEntries);
        Assert.Contains(attendanceAuditEntries, log =>
            !string.IsNullOrWhiteSpace(log.OldValueJson) &&
            !string.IsNullOrWhiteSpace(log.NewValueJson));
    }

    [Fact]
    public async Task Administrator_is_forbidden_and_unassigned_coach_is_forbidden_for_group_attendance_api()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var adminSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        Assert.Equal("Administrator", adminSession.User?.Role);

        using var forbiddenGroupsResponse = await client.GetAsync("/attendance/groups");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenGroupsResponse.StatusCode);

        using var forbiddenSaveForAdmin = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = DateTimeOffset.UtcNow.Date.ToString("yyyy-MM-dd"),
                AttendanceMarks = Array.Empty<object>()
            },
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenSaveForAdmin.StatusCode);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using var forbiddenCoachGroupClients = await coachClient.GetAsync(
            $"/attendance/groups/{seeded.UnassignedGroupId}/clients?trainingDate={DateTimeOffset.UtcNow.Date:yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenCoachGroupClients.StatusCode);

        using var forbiddenCoachSave = await PostJsonAsync(
            coachClient,
            $"/attendance/groups/{seeded.UnassignedGroupId}",
            new
            {
                TrainingDate = DateTimeOffset.UtcNow.Date.ToString("yyyy-MM-dd"),
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        IsPresent = true
                    }
                }
            },
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenCoachSave.StatusCode);
    }

    [Fact]
    public async Task Attendance_warning_does_not_block_marking_and_is_stored_for_training_date()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var coachSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        var pastTrainingDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-2));
        var pastTrainingDateString = pastTrainingDate.ToString("yyyy-MM-dd");

        using var clientsResponse = await client.GetAsync(
            $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={pastTrainingDateString}");
        var clientsResponseBody = await clientsResponse.Content.ReadAsStringAsync();
        Assert.True(
            clientsResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {clientsResponse.StatusCode}. Body: {clientsResponseBody}");

        var clientsPayload = await ReadJsonElementAsync(clientsResponse);
        var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
        var warningClient = FindById(clients, seeded.WarningClientId);
        Assert.False(warningClient.ValueKind == JsonValueKind.Undefined);
        Assert.True(HasMembershipWarning(warningClient), "Expected warning signal in client payload.");

        using var markResponse = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = pastTrainingDateString,
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.WarningClientId,
                        IsPresent = true
                    }
                }
            },
            coachSession.CsrfToken);

        var markResponseBody = await markResponse.Content.ReadAsStringAsync();
        if (!markResponse.IsSuccessStatusCode)
        {
            throw new Xunit.Sdk.XunitException(
                $"Expected success, got {markResponse.StatusCode}. Body: {markResponseBody}");
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedAttendance = await dbContext.Attendance.SingleOrDefaultAsync(
            mark => mark.ClientId == seeded.WarningClientId &&
                mark.GroupId == seeded.AssignedGroupId &&
                mark.TrainingDate == pastTrainingDate);

        Assert.NotNull(persistedAttendance);
        Assert.True(persistedAttendance.IsPresent);
    }

    private static async Task<SeededAttendanceData> SeedAttendanceDataAsync(AttendanceAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage7-password";

        var headCoach = CreateUser("headcoach-stage7", "Главный тренер Stage 7", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser(
            "administrator-stage7",
            "Администратор Stage 7",
            UserRole.Administrator,
            sharedPassword,
            now,
            passwordHashService);
        var coach = CreateUser("coach-stage7", "Тренер Stage 7", UserRole.Coach, sharedPassword, now, passwordHashService);

        var assignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Group",
            TrainingStartTime = new TimeOnly(8, 0),
            ScheduleText = "Пн,Ср,Пт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var unassignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Unassigned Group",
            TrainingStartTime = new TimeOnly(19, 0),
            ScheduleText = "Вт,Чт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var warningClient = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "Проблемный",
            FirstName = "Клиент",
            Phone = "+79990001110",
            CreatedAt = now,
            UpdatedAt = now
        };

        var singleVisitClient = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "Разовый",
            FirstName = "Клиент",
            Phone = "+79990001111",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.TrainingGroups.AddRange(assignedGroup, unassignedGroup);
        dbContext.Clients.AddRange(warningClient, singleVisitClient);
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = assignedGroup.Id,
            TrainerId = coach.Id
        });
        await dbContext.SaveChangesAsync();

        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = warningClient.Id,
            GroupId = assignedGroup.Id
        });
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = singleVisitClient.Id,
            GroupId = assignedGroup.Id
        });

        await AddMembershipAsync(
            dbContext,
            warningClient.Id,
            coach.Id,
            MembershipType.Monthly,
            DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-2).Date),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1).Date),
            1200m,
            isPaid: false,
            singleVisitUsed: false,
            seedBy: coach.Id);

        await AddMembershipAsync(
            dbContext,
            singleVisitClient.Id,
            coach.Id,
            MembershipType.SingleVisit,
            DateOnly.FromDateTime(DateTime.UtcNow.Date),
            null,
            500m,
            isPaid: true,
            singleVisitUsed: false,
            seedBy: coach.Id);

        await dbContext.SaveChangesAsync();

        return new SeededAttendanceData(
            headCoach.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            assignedGroup.Id,
            unassignedGroup.Id,
            warningClient.Id,
            singleVisitClient.Id);
    }

    private static async Task AddMembershipAsync(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid changedByUserId,
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool isPaid,
        bool singleVisitUsed,
        Guid seedBy)
    {
        var now = DateTimeOffset.UtcNow;
        dbContext.ClientMemberships.Add(new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            MembershipType = membershipType,
            PurchaseDate = purchaseDate,
            ExpirationDate = expirationDate,
            PaymentAmount = paymentAmount,
            IsPaid = isPaid,
            SingleVisitUsed = singleVisitUsed,
            ChangedByUserId = changedByUserId,
            PaidByUserId = isPaid ? seedBy : null,
            PaidAt = isPaid ? now : null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ValidFrom = now,
            CreatedAt = now
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

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
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

    private static JsonElement GetPropertyOrNull(JsonElement payload, params string[] propertyNames)
    {
        var nameSet = propertyNames.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return default;
        }

        foreach (var property in payload.EnumerateObject())
        {
            if (nameSet.Contains(property.Name))
            {
                return property.Value;
            }
        }

        return default;
    }

    private static bool? GetBoolFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsedValue) => parsedValue,
            _ => null
        };
    }

    private static string? GetStringFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    private static Guid GetGuidFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        if (value.ValueKind != JsonValueKind.String)
        {
            return Guid.Empty;
        }

        return Guid.TryParse(value.GetString(), out var parsedValue)
            ? parsedValue
            : Guid.Empty;
    }

    private static JsonElement FindById(JsonElement array, Guid id)
    {
        if (array.ValueKind != JsonValueKind.Array)
        {
            return default;
        }

        foreach (var item in array.EnumerateArray())
        {
            var itemId = GetGuidFromAnyCase(item, "clientId", "ClientId", "id", "Id");
            if (itemId == id)
            {
                return item;
            }
        }

        return default;
    }

    private static bool HasMembershipWarning(JsonElement clientPayload)
    {
        var explicitWarning = GetBoolFromAnyCase(
            clientPayload,
            "hasWarning",
            "membershipWarning",
            "hasMembershipWarning",
            "membershipWarningVisible",
            "hasMembershipIssue");
        if (explicitWarning is not null)
        {
            return explicitWarning.Value;
        }

        var warningMessage = GetStringFromAnyCase(
            clientPayload,
            "warning",
            "warningMessage",
            "membershipWarningMessage",
            "membershipStatusMessage");
        if (!string.IsNullOrWhiteSpace(warningMessage))
        {
            return true;
        }

        var isPaid = GetBoolFromAnyCase(clientPayload, "isPaid", "paid");
        if (isPaid is false)
        {
            return true;
        }

        var membershipPayload = GetPropertyOrNull(clientPayload, "currentMembership", "membership", "membershipData");
        if (membershipPayload.ValueKind == JsonValueKind.Object)
        {
            var membershipIsPaid = GetBoolFromAnyCase(
                membershipPayload,
                "isPaid",
                "paid",
                "isActive");
            if (membershipIsPaid is false)
            {
                return true;
            }

            var singleVisitUsed = GetBoolFromAnyCase(
                membershipPayload,
                "singleVisitUsed",
                "singleVisitHasBeenUsed");
            if (singleVisitUsed is true && GetStringFromAnyCase(membershipPayload, "membershipType", "type") == "SingleVisit")
            {
                return true;
            }

            var expirationDate = GetStringFromAnyCase(
                membershipPayload,
                "expirationDate",
                "expiresAt",
                "membershipExpirationDate");
            if (DateOnly.TryParse(expirationDate, out var parsedExpirationDate))
            {
                if (parsedExpirationDate < DateOnly.FromDateTime(DateTime.UtcNow.Date))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role);

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SeededAttendanceData(
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid AssignedGroupId,
        Guid UnassignedGroupId,
        Guid WarningClientId,
        Guid SingleVisitClientId);

    private sealed class AttendanceAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-stage7",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 7"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-attendance-tests-{Guid.NewGuid():N}";
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
