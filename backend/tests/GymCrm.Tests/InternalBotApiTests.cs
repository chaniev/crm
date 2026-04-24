using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Bot;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Audit;
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

public class InternalBotApiTests
{
    private const string ServiceToken = "bot-internal-service-token";

    [Fact]
    public async Task Internal_bot_requires_service_token_and_resolves_identity_states()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();

        using (var missingTokenResponse = await client.GetAsync($"/internal/bot/menu?platform=Telegram&platformUserId={seeded.HeadCoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.Unauthorized, missingTokenResponse.StatusCode);
        }

        using (var resolveKnown = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/telegram/session/resolve",
                   new TelegramIdentityRequest("Telegram", seeded.HeadCoachTelegramId),
                   requestId: "req-known"))
        {
            Assert.Equal(HttpStatusCode.OK, resolveKnown.StatusCode);
            Assert.Equal("req-known", resolveKnown.Headers.GetValues("X-Request-Id").Single());

            var payload = await ReadJsonElementAsync(resolveKnown);
            Assert.Equal("HeadCoach", payload.GetProperty("role").GetString());
            Assert.Equal(seeded.HeadCoachTelegramId, payload.GetProperty("platformUserId").GetString());
        }

        using (var resolveUnknown = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/telegram/session/resolve",
                   new TelegramIdentityRequest("Telegram", "unknown-telegram-id")))
        {
            Assert.Equal(HttpStatusCode.NotFound, resolveUnknown.StatusCode);
        }

        using (var resolveInactive = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/telegram/session/resolve",
                   new TelegramIdentityRequest("Telegram", seeded.InactiveTelegramId)))
        {
            Assert.Equal(HttpStatusCode.Forbidden, resolveInactive.StatusCode);
            var payload = await ReadJsonElementAsync(resolveInactive);
            Assert.Equal("CrmUserInactive", payload.GetProperty("title").GetString());
        }

        using (var resolveMustChangePassword = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/telegram/session/resolve",
                   new TelegramIdentityRequest("Telegram", seeded.MustChangePasswordTelegramId)))
        {
            Assert.Equal(HttpStatusCode.Forbidden, resolveMustChangePassword.StatusCode);
            var payload = await ReadJsonElementAsync(resolveMustChangePassword);
            Assert.Equal("PasswordChangeRequired", payload.GetProperty("title").GetString());
        }
    }

    [Fact]
    public async Task Internal_bot_menu_and_attendance_rules_apply_by_role()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        using (var adminMenuResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/menu?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminMenuResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminMenuResponse);
            var items = payload.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("code").GetString()).ToArray();
            Assert.Contains("unpaid-memberships", items);
            Assert.Contains("expiring-memberships", items);
        }

        using (var coachMenuResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/menu?platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, coachMenuResponse.StatusCode);
            var payload = await ReadJsonElementAsync(coachMenuResponse);
            var items = payload.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("code").GetString()).ToArray();
            Assert.Equal(2, items.Length);
            Assert.DoesNotContain("unpaid-memberships", items);
        }

        using (var adminGroupsResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminGroupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminGroupsResponse);
            Assert.Contains(payload.EnumerateArray(), item => item.GetProperty("id").GetString() == seeded.CoachGroupId.ToString());
        }

        using (var adminSaveResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/attendance/groups/{seeded.CoachGroupId}",
                   new BotSaveAttendanceRequest(
                       "Telegram",
                       seeded.AdminTelegramId,
                       today.AddDays(-5).ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]),
                   idempotencyKey: "attendance-admin-old-date"))
        {
            Assert.Equal(HttpStatusCode.OK, adminSaveResponse.StatusCode);
        }

        using (var coachOldDateResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/attendance/groups/{seeded.CoachGroupId}",
                   new BotSaveAttendanceRequest(
                       "Telegram",
                       seeded.CoachTelegramId,
                       today.AddDays(-3).ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]),
                   idempotencyKey: "attendance-coach-too-old"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, coachOldDateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(coachOldDateResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("trainingDate", out _));
        }

        using (var futureDateResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/attendance/groups/{seeded.CoachGroupId}",
                   new BotSaveAttendanceRequest(
                       "Telegram",
                       seeded.AdminTelegramId,
                       today.AddDays(1).ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]),
                   idempotencyKey: "attendance-future-date"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, futureDateResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Coach_client_payload_is_restricted_and_membership_lists_are_role_scoped()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();

        using (var searchResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients?q=Coach&platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, searchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(searchResponse);
            var item = payload.GetProperty("items")[0];
            Assert.Equal(JsonValueKind.Null, item.GetProperty("phone").ValueKind);
        }

        using (var cardResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/{seeded.CoachClientId}?platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, cardResponse.StatusCode);
            var payload = await ReadJsonElementAsync(cardResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("phone").ValueKind);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("currentMembership").ValueKind);
        }

        using (var coachExpiringResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/expiring-memberships?platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, coachExpiringResponse.StatusCode);
        }

        using (var adminExpiringResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/expiring-memberships?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminExpiringResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminExpiringResponse);
            var ids = payload.EnumerateArray().Select(item => item.GetProperty("clientId").GetString()).ToArray();
            Assert.Contains(seeded.ExpiringTodayClientId.ToString(), ids);
            Assert.Contains(seeded.ExpiringDayTenClientId.ToString(), ids);
            Assert.DoesNotContain(seeded.ExpiringDayElevenClientId.ToString(), ids);
            Assert.DoesNotContain(seeded.ExpiredClientId.ToString(), ids);
        }

        using (var adminUnpaidResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/unpaid-memberships?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminUnpaidResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminUnpaidResponse);
            var ids = payload.EnumerateArray().Select(item => item.GetProperty("clientId").GetString()).ToArray();
            Assert.Contains(seeded.PaymentClientId.ToString(), ids);
        }
    }

    [Fact]
    public async Task Mark_payment_and_access_denied_are_idempotent_and_write_bot_audit()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();

        using (var firstMarkPayment = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/clients/{seeded.PaymentClientId}/membership/mark-payment",
                   new TelegramIdentityRequest("Telegram", seeded.AdminTelegramId),
                   idempotencyKey: "payment-idempotent"))
        {
            Assert.Equal(HttpStatusCode.OK, firstMarkPayment.StatusCode);
            var payload = await ReadJsonElementAsync(firstMarkPayment);
            Assert.False(payload.GetProperty("wasAlreadyPaid").GetBoolean());
        }

        using (var secondMarkPayment = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/clients/{seeded.PaymentClientId}/membership/mark-payment",
                   new TelegramIdentityRequest("Telegram", seeded.AdminTelegramId),
                   idempotencyKey: "payment-idempotent"))
        {
            Assert.Equal(HttpStatusCode.OK, secondMarkPayment.StatusCode);
            var payload = await ReadJsonElementAsync(secondMarkPayment);
            Assert.False(payload.GetProperty("wasAlreadyPaid").GetBoolean());
        }

        using (var missingAccessDeniedIdempotency = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/audit/access-denied",
                   new BotAccessDeniedAuditHttpRequest("Telegram", seeded.CoachTelegramId, "PhoneSearchDenied", "Client", seeded.CoachClientId.ToString(), "Coach cannot search by phone"),
                   includeIdempotencyHeader: false))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingAccessDeniedIdempotency.StatusCode);
        }

        using (var firstAccessDenied = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/audit/access-denied",
                   new BotAccessDeniedAuditHttpRequest("Telegram", seeded.CoachTelegramId, "PhoneSearchDenied", "Client", seeded.CoachClientId.ToString(), "Coach cannot search by phone"),
                   idempotencyKey: "access-denied-idempotent"))
        {
            Assert.Equal(HttpStatusCode.OK, firstAccessDenied.StatusCode);
        }

        using (var secondAccessDenied = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/audit/access-denied",
                   new BotAccessDeniedAuditHttpRequest("Telegram", seeded.CoachTelegramId, "PhoneSearchDenied", "Client", seeded.CoachClientId.ToString(), "Coach cannot search by phone"),
                   idempotencyKey: "access-denied-idempotent"))
        {
            Assert.Equal(HttpStatusCode.OK, secondAccessDenied.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var paymentClientMembership = await dbContext.ClientMemberships.SingleAsync(membership =>
            membership.ClientId == seeded.PaymentClientId &&
            membership.ValidTo == null);
        Assert.True(paymentClientMembership.IsPaid);

        var paymentAuditCount = await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == BotAuditConstants.BotMembershipPaymentMarkedAction &&
            log.Source == "Bot" &&
            log.MessengerPlatform == "Telegram");
        Assert.Equal(1, paymentAuditCount);

        var accessDeniedAuditCount = await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == BotAuditConstants.BotAccessDeniedAction &&
            log.Source == "Bot" &&
            log.MessengerPlatform == "Telegram");
        Assert.Equal(1, accessDeniedAuditCount);
    }

    private static async Task<SeededBotData> SeedDataAsync(InternalBotAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        dbContext.Users.RemoveRange(dbContext.Users);
        dbContext.TrainingGroups.RemoveRange(dbContext.TrainingGroups);
        dbContext.Clients.RemoveRange(dbContext.Clients);
        dbContext.ClientMemberships.RemoveRange(dbContext.ClientMemberships);
        dbContext.ClientGroups.RemoveRange(dbContext.ClientGroups);
        dbContext.GroupTrainers.RemoveRange(dbContext.GroupTrainers);
        dbContext.Attendance.RemoveRange(dbContext.Attendance);
        dbContext.AuditLogs.RemoveRange(dbContext.AuditLogs);
        await dbContext.SaveChangesAsync();

        var passwordHashService = scope.ServiceProvider.GetRequiredService<Application.Security.IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var sharedPassword = "internal-bot-password";

        var headCoach = CreateUser("bot-headcoach", "Bot HeadCoach", UserRole.HeadCoach, sharedPassword, passwordHashService, now, "tg-headcoach");
        var administrator = CreateUser("bot-admin", "Bot Administrator", UserRole.Administrator, sharedPassword, passwordHashService, now, "tg-admin");
        var coach = CreateUser("bot-coach", "Bot Coach", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-coach");
        var inactiveCoach = CreateUser("bot-inactive", "Bot Inactive", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-inactive", isActive: false);
        var mustChangePasswordCoach = CreateUser("bot-password", "Bot Password", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-password", mustChangePassword: true);

        var coachGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Coach Group",
            TrainingStartTime = new TimeOnly(10, 0),
            ScheduleText = "Mon/Wed/Fri",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var adminGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Admin Group",
            TrainingStartTime = new TimeOnly(12, 0),
            ScheduleText = "Tue/Thu",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var coachClient = CreateClient("Coach", "Client", "+79990000001", now);
        var expiringTodayClient = CreateClient("Expiring", "Today", "+79990000002", now);
        var expiringDayTenClient = CreateClient("Expiring", "Ten", "+79990000003", now);
        var expiringDayElevenClient = CreateClient("Expiring", "Eleven", "+79990000004", now);
        var expiredClient = CreateClient("Expired", "Client", "+79990000005", now);
        var paymentClient = CreateClient("Payment", "Client", "+79990000006", now);

        dbContext.Users.AddRange(headCoach, administrator, coach, inactiveCoach, mustChangePasswordCoach);
        dbContext.TrainingGroups.AddRange(coachGroup, adminGroup);
        dbContext.Clients.AddRange(coachClient, expiringTodayClient, expiringDayTenClient, expiringDayElevenClient, expiredClient, paymentClient);
        dbContext.GroupTrainers.Add(new GroupTrainer { GroupId = coachGroup.Id, TrainerId = coach.Id });
        dbContext.ClientGroups.AddRange(
            new ClientGroup { ClientId = coachClient.Id, GroupId = coachGroup.Id },
            new ClientGroup { ClientId = expiringTodayClient.Id, GroupId = adminGroup.Id },
            new ClientGroup { ClientId = expiringDayTenClient.Id, GroupId = adminGroup.Id },
            new ClientGroup { ClientId = expiringDayElevenClient.Id, GroupId = adminGroup.Id },
            new ClientGroup { ClientId = expiredClient.Id, GroupId = adminGroup.Id },
            new ClientGroup { ClientId = paymentClient.Id, GroupId = adminGroup.Id });

        dbContext.ClientMemberships.AddRange(
            CreateMembership(coachClient.Id, coach.Id, today.AddDays(-1), today.AddDays(5), 1200m, isPaid: false, now),
            CreateMembership(expiringTodayClient.Id, administrator.Id, today.AddDays(-10), today, 1500m, isPaid: true, now),
            CreateMembership(expiringDayTenClient.Id, administrator.Id, today.AddDays(-10), today.AddDays(10), 1500m, isPaid: true, now),
            CreateMembership(expiringDayElevenClient.Id, administrator.Id, today.AddDays(-10), today.AddDays(11), 1500m, isPaid: true, now),
            CreateMembership(expiredClient.Id, administrator.Id, today.AddDays(-20), today.AddDays(-1), 1500m, isPaid: true, now),
            CreateMembership(paymentClient.Id, administrator.Id, today.AddDays(-3), today.AddDays(20), 1800m, isPaid: false, now));

        dbContext.Attendance.Add(new Attendance
        {
            Id = Guid.NewGuid(),
            ClientId = coachClient.Id,
            GroupId = coachGroup.Id,
            TrainingDate = today.AddDays(-1),
            IsPresent = true,
            MarkedByUserId = coach.Id,
            MarkedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync();

        return new SeededBotData(
            headCoach.MessengerPlatformUserId!,
            administrator.MessengerPlatformUserId!,
            coach.MessengerPlatformUserId!,
            inactiveCoach.MessengerPlatformUserId!,
            mustChangePasswordCoach.MessengerPlatformUserId!,
            coachGroup.Id,
            coachClient.Id,
            expiringTodayClient.Id,
            expiringDayTenClient.Id,
            expiringDayElevenClient.Id,
            expiredClient.Id,
            paymentClient.Id);
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        string password,
        Application.Security.IPasswordHashService passwordHashService,
        DateTimeOffset now,
        string telegramId,
        bool isActive = true,
        bool mustChangePassword = false)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Login = login,
            FullName = fullName,
            Role = role,
            MessengerPlatform = MessengerPlatform.Telegram,
            MessengerPlatformUserId = telegramId,
            IsActive = isActive,
            MustChangePassword = mustChangePassword,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);
        return user;
    }

    private static Client CreateClient(string lastName, string firstName, string phone, DateTimeOffset now)
    {
        return new Client
        {
            Id = Guid.NewGuid(),
            LastName = lastName,
            FirstName = firstName,
            Phone = phone,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static ClientMembership CreateMembership(
        Guid clientId,
        Guid changedByUserId,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool isPaid,
        DateTimeOffset now)
    {
        return new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            MembershipType = MembershipType.Monthly,
            PurchaseDate = purchaseDate,
            ExpirationDate = expirationDate,
            PaymentAmount = paymentAmount,
            IsPaid = isPaid,
            SingleVisitUsed = false,
            PaidByUserId = isPaid ? changedByUserId : null,
            PaidAt = isPaid ? now : null,
            ValidFrom = now,
            ValidTo = null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ChangedByUserId = changedByUserId,
            CreatedAt = now
        };
    }

    private static async Task<HttpResponseMessage> SendBotRequestAsync(
        HttpClient client,
        HttpMethod method,
        string url,
        object? body = null,
        string? idempotencyKey = null,
        string? requestId = null,
        bool includeIdempotencyHeader = true)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ServiceToken);

        if (!string.IsNullOrWhiteSpace(requestId))
        {
            request.Headers.Add("X-Request-Id", requestId);
        }

        if (includeIdempotencyHeader && !string.IsNullOrWhiteSpace(idempotencyKey))
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        return document.RootElement.Clone();
    }

    private sealed record TelegramIdentityRequest(string Platform, string PlatformUserId);

    private sealed record BotAttendanceMarkRequest(Guid ClientId, bool IsPresent);

    private sealed record BotSaveAttendanceRequest(
        string Platform,
        string PlatformUserId,
        string TrainingDate,
        IReadOnlyList<BotAttendanceMarkRequest> AttendanceMarks);

    private sealed record BotAccessDeniedAuditHttpRequest(
        string Platform,
        string PlatformUserId,
        string ActionCode,
        string? EntityType,
        string? EntityId,
        string? Reason);

    private sealed record SeededBotData(
        string HeadCoachTelegramId,
        string AdminTelegramId,
        string CoachTelegramId,
        string InactiveTelegramId,
        string MustChangePasswordTelegramId,
        Guid CoachGroupId,
        Guid CoachClientId,
        Guid ExpiringTodayClientId,
        Guid ExpiringDayTenClientId,
        Guid ExpiringDayElevenClientId,
        Guid ExpiredClientId,
        Guid PaymentClientId);

    private sealed class InternalBotAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-bot",
                    ["BootstrapUser:FullName"] = "Bootstrap Bot",
                    ["BotInternalApi:Enabled"] = "true",
                    ["BotInternalApi:Token"] = ServiceToken,
                    ["BotIdempotency:RecordTtl"] = "1.00:00:00"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-internal-bot-tests-{Guid.NewGuid():N}";
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
