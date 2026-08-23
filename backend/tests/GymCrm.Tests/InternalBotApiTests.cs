using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Bot;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using GymCrm.Infrastructure.Persistence.Configurations;
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

        using (var resolveSuperAdministrator = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   "/internal/bot/telegram/session/resolve",
                   new TelegramIdentityRequest("Telegram", seeded.SuperAdministratorTelegramId)))
        {
            Assert.Equal(HttpStatusCode.OK, resolveSuperAdministrator.StatusCode);
            var payload = await ReadJsonElementAsync(resolveSuperAdministrator);
            Assert.Equal("SuperAdministrator", payload.GetProperty("role").GetString());
            Assert.Equal(
                seeded.SuperAdministratorTelegramId,
                payload.GetProperty("platformUserId").GetString());
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
        var today = GetBusinessToday();

        using (var adminMenuResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/menu?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminMenuResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminMenuResponse);
            var items = payload.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("code").GetString()).ToArray();
            Assert.Contains("attendance", items);
            Assert.DoesNotContain("unpaid_memberships", items);
            Assert.Contains("expiring_memberships", items);
        }

        using (var superAdministratorMenuResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/menu?platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdministratorMenuResponse.StatusCode);
            var payload = await ReadJsonElementAsync(superAdministratorMenuResponse);
            var items = payload.GetProperty("items")
                .EnumerateArray()
                .Select(item => item.GetProperty("code").GetString()!)
                .ToArray();
            Assert.Equal(
                ["attendance", "client_search", "expiring_memberships"],
                items);
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
            Assert.DoesNotContain("unpaid_memberships", items);
        }

        using (var adminGroupsResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, adminGroupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminGroupsResponse);
            Assert.Empty(payload.EnumerateArray());
        }

        using (var superAdministratorGroupsResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdministratorGroupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(superAdministratorGroupsResponse);
            var groupIds = payload.EnumerateArray()
                .Select(item => Guid.Parse(item.GetProperty("id").GetString()!))
                .ToArray();
            Assert.Contains(seeded.CoachGroupId, groupIds);
            Assert.Contains(seeded.AdminGroupId, groupIds);
        }

        using (var headCoachGroupsResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.HeadCoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachGroupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(headCoachGroupsResponse);
            var coachGroupPayload = payload.EnumerateArray().Single(item => item.GetProperty("id").GetString() == seeded.CoachGroupId.ToString());
            Assert.NotEqual(Guid.Empty, Guid.Parse(coachGroupPayload.GetProperty("branchId").GetString()!));
            Assert.NotEqual(Guid.Empty, Guid.Parse(coachGroupPayload.GetProperty("hallId").GetString()!));
            Assert.Equal(60, coachGroupPayload.GetProperty("durationMinutes").GetInt32());
            Assert.Equal(
                [1, 3],
                coachGroupPayload.GetProperty("weekdays").EnumerateArray().Select(weekday => weekday.GetInt32()).ToArray());
        }

        foreach (var (groupId, clientId, idempotencyKey) in new[]
                 {
                     (seeded.CoachGroupId, seeded.CoachClientId, "attendance-sa-coach-branch"),
                     (seeded.AdminGroupId, seeded.ExpiringTodayClientId, "attendance-sa-admin-branch")
                 })
        {
            using (var rosterResponse = await SendBotRequestAsync(
                       client,
                       HttpMethod.Get,
                       $"/internal/bot/attendance/groups/{groupId}/clients" +
                       $"?platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}" +
                       $"&trainingDate={today:yyyy-MM-dd}"))
            {
                Assert.Equal(HttpStatusCode.OK, rosterResponse.StatusCode);
            }

            using var saveResponse = await SendBotRequestAsync(
                client,
                HttpMethod.Post,
                $"/internal/bot/attendance/groups/{groupId}",
                new BotSaveAttendanceRequest(
                    "Telegram",
                    seeded.SuperAdministratorTelegramId,
                    today.ToString("yyyy-MM-dd"),
                    [new BotAttendanceMarkRequest(clientId, false)]),
                idempotencyKey: idempotencyKey);
            Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        }

        await using (var superAdministratorScope = factory.Services.CreateAsyncScope())
        {
            var db = superAdministratorScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var markedGroups = await db.Attendance
                .Where(attendance =>
                    attendance.MarkedByUserId == seeded.SuperAdministratorId &&
                    attendance.TrainingDate == today)
                .Select(attendance => attendance.GroupId)
                .ToListAsync();
            Assert.Contains(seeded.CoachGroupId, markedGroups);
            Assert.Contains(seeded.AdminGroupId, markedGroups);
        }

        await using (var membershipScope = factory.Services.CreateAsyncScope())
        {
            var db = membershipScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var membership = await db.ClientMemberships
                .Include(candidate => candidate.Sale)
                .SingleAsync(candidate => candidate.ClientId == seeded.CoachClientId && candidate.ValidTo == null);
            membership.BehaviorKind = MembershipBehaviorKind.SingleVisit;
            membership.Sale.BehaviorKind = MembershipBehaviorKind.SingleVisit;
            membership.Sale.PurchaseDate = today.AddDays(-10);
            membership.Sale.PaymentDate = today.AddDays(-10);
            membership.IndividualValidTo = null;
            membership.SingleVisitUsed = false;
            await db.SaveChangesAsync();
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
            Assert.Equal(HttpStatusCode.Forbidden, adminSaveResponse.StatusCode);
        }

        using (var headCoachSaveResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/attendance/groups/{seeded.CoachGroupId}",
                   new BotSaveAttendanceRequest(
                       "Telegram",
                       seeded.HeadCoachTelegramId,
                       today.AddDays(-5).ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]),
                   idempotencyKey: "attendance-headcoach-old-date"))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachSaveResponse.StatusCode);
        }

        await using (var auditScope = factory.Services.CreateAsyncScope())
        {
            var db = auditScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Contains(await db.AuditLogs.ToListAsync(), log =>
                log.ActionType == AttendanceAuditContract.AttendanceMarkedAction &&
                log.Source == "Bot" &&
                log.MessengerPlatform == "Telegram");
            Assert.Contains(await db.AuditLogs.ToListAsync(), log =>
                log.ActionType == AttendanceAuditContract.SingleVisitWrittenOffAction &&
                log.Source == "Bot" &&
                log.MessengerPlatform == "Telegram");
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
                       seeded.HeadCoachTelegramId,
                       today.AddDays(1).ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]),
                   idempotencyKey: "attendance-future-date"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, futureDateResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Internal_bot_administrator_with_attendance_grant_can_list_roster_and_save_old_date_until_revoked()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();
        var trainingDate = GetBusinessToday().AddDays(-5);

        await using (var grantScope = factory.Services.CreateAsyncScope())
        {
            var db = grantScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var branchId = await db.TrainingGroups
                .Where(group => group.Id == seeded.AdminGroupId)
                .Select(group => group.BranchId)
                .SingleAsync();
            db.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
            {
                AdministratorId = seeded.AdminId,
                GroupId = seeded.AdminGroupId,
                BranchId = branchId,
                GrantedByUserId = seeded.SuperAdministratorId,
                GrantedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        using (var menuResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/menu?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, menuResponse.StatusCode);
            var payload = await ReadJsonElementAsync(menuResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("attendanceDateWindow").GetProperty("minTrainingDate").ValueKind);
        }

        using (var groupsResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupsResponse);
            Assert.Contains(payload.EnumerateArray(), group => group.GetProperty("id").GetString() == seeded.AdminGroupId.ToString());
        }

        using (var rosterResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/attendance/groups/{seeded.AdminGroupId}/clients" +
                   $"?platform=Telegram&platformUserId={seeded.AdminTelegramId}" +
                   $"&trainingDate={trainingDate:yyyy-MM-dd}"))
        {
            Assert.Equal(HttpStatusCode.OK, rosterResponse.StatusCode);
            var payload = await ReadJsonElementAsync(rosterResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("attendanceDateWindow").GetProperty("minTrainingDate").ValueKind);
            Assert.Contains(payload.GetProperty("clients").EnumerateArray(), candidate =>
                candidate.GetProperty("id").GetString() == seeded.ExpiringTodayClientId.ToString());
        }

        using (var saveResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/attendance/groups/{seeded.AdminGroupId}",
                   new BotSaveAttendanceRequest(
                       "Telegram",
                       seeded.AdminTelegramId,
                       trainingDate.ToString("yyyy-MM-dd"),
                       [new BotAttendanceMarkRequest(seeded.ExpiringTodayClientId, false)]),
                   idempotencyKey: "attendance-admin-granted-old-date"))
        {
            Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
            var payload = await ReadJsonElementAsync(saveResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("attendanceDateWindow").GetProperty("minTrainingDate").ValueKind);
        }

        await using (var revokeScope = factory.Services.CreateAsyncScope())
        {
            var db = revokeScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var grant = await db.AdministratorAttendanceGroupGrants.SingleAsync(grant =>
                grant.AdministratorId == seeded.AdminId &&
                grant.GroupId == seeded.AdminGroupId);
            db.AdministratorAttendanceGroupGrants.Remove(grant);
            await db.SaveChangesAsync();
        }

        using var forbiddenRosterResponse = await SendBotRequestAsync(
            client,
            HttpMethod.Get,
            $"/internal/bot/attendance/groups/{seeded.AdminGroupId}/clients" +
            $"?platform=Telegram&platformUserId={seeded.AdminTelegramId}" +
            $"&trainingDate={trainingDate:yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRosterResponse.StatusCode);
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
            Assert.NotEqual(Guid.Empty, Guid.Parse(item.GetProperty("branchId").GetString()!));
        }

        using (var cardResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/{seeded.CoachClientId}?platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, cardResponse.StatusCode);
            var payload = await ReadJsonElementAsync(cardResponse);
            Assert.Equal(JsonValueKind.Null, payload.GetProperty("phone").ValueKind);
            Assert.Empty(payload.GetProperty("currentMemberships").EnumerateArray());
            var groupPayload = payload.GetProperty("groups").EnumerateArray()
                .Single(group => group.GetProperty("id").GetString() == seeded.CoachGroupId.ToString());
            Assert.Equal(60, groupPayload.GetProperty("durationMinutes").GetInt32());
            Assert.Equal(
                [1, 3],
                groupPayload.GetProperty("weekdays").EnumerateArray().Select(weekday => weekday.GetInt32()).ToArray());
        }

        using (var coachExpiringResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/expiring-memberships?platform=Telegram&platformUserId={seeded.CoachTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, coachExpiringResponse.StatusCode);
        }

        using (var superAdministratorPhoneSearchResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   "/internal/bot/clients?q=%2B79990000002" +
                   $"&platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdministratorPhoneSearchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(superAdministratorPhoneSearchResponse);
            var item = payload.GetProperty("items").EnumerateArray()
                .Single(candidate =>
                    candidate.GetProperty("id").GetString() == seeded.ExpiringTodayClientId.ToString());
            Assert.Equal("+79990000002", item.GetProperty("phone").GetString());
        }

        using (var superAdministratorNameSearchResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients?q=Coach&platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdministratorNameSearchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(superAdministratorNameSearchResponse);
            Assert.Contains(
                payload.GetProperty("items").EnumerateArray(),
                item => item.GetProperty("id").GetString() == seeded.CoachClientId.ToString());
        }

        using (var superAdministratorExpiringResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/expiring-memberships?platform=Telegram&platformUserId={seeded.SuperAdministratorTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdministratorExpiringResponse.StatusCode);
            var payload = await ReadJsonElementAsync(superAdministratorExpiringResponse);
            var ids = payload.EnumerateArray()
                .Select(item => item.GetProperty("clientId").GetString())
                .ToArray();
            Assert.Contains(seeded.CoachClientId.ToString(), ids);
            Assert.Contains(seeded.ExpiringTodayClientId.ToString(), ids);
            Assert.Contains(seeded.ExpiringDayNineClientId.ToString(), ids);
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
            Assert.Contains(seeded.ExpiringDayNineClientId.ToString(), ids);
            Assert.DoesNotContain(seeded.ExpiringDayTenClientId.ToString(), ids);
            Assert.DoesNotContain(seeded.ExpiringDayElevenClientId.ToString(), ids);
            Assert.DoesNotContain(seeded.ExpiredClientId.ToString(), ids);
        }

        using (var adminUnpaidResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/unpaid-memberships?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.Gone, adminUnpaidResponse.StatusCode);
            var payload = await ReadJsonElementAsync(adminUnpaidResponse);
            Assert.Equal("membership-unpaid-list-removed", payload.GetProperty("type").GetString());
        }

        using (var amountOnlyCardResponse = await SendBotRequestAsync(
                   client,
                   HttpMethod.Get,
                   $"/internal/bot/clients/{seeded.PaymentClientId}?platform=Telegram&platformUserId={seeded.AdminTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, amountOnlyCardResponse.StatusCode);
            var payload = await ReadJsonElementAsync(amountOnlyCardResponse);
            var membership = Assert.Single(payload.GetProperty("currentMemberships").EnumerateArray());
            Assert.Equal(JsonValueKind.Null, membership.GetProperty("membershipCatalogItemId").ValueKind);
            Assert.Equal("Без варианта каталога", membership.GetProperty("membershipLabel").GetString());
            Assert.Equal("AmountOnly", membership.GetProperty("pricingMode").GetString());
            Assert.Equal(1800m, membership.GetProperty("grossAmount").GetDecimal());
            Assert.Equal(JsonValueKind.Null, membership.GetProperty("catalogPrice").ValueKind);
            Assert.NotEqual(Guid.Empty, membership.GetProperty("saleId").GetGuid());
            Assert.Equal("TargetGroups", membership.GetProperty("coverageKind").GetString());
            Assert.NotEmpty(membership.GetProperty("targetGroups").EnumerateArray());
        }
    }

    [Fact]
    public async Task Removed_mark_payment_is_tombstone_and_access_denied_is_idempotent()
    {
        await using var factory = new InternalBotAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();

        using (var firstMarkPayment = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/clients/{seeded.PaymentClientId}/membership/mark-payment",
                   new TelegramIdentityRequest("Telegram", seeded.AdminTelegramId),
                   includeIdempotencyHeader: false))
        {
            Assert.Equal(HttpStatusCode.Gone, firstMarkPayment.StatusCode);
            var payload = await ReadJsonElementAsync(firstMarkPayment);
            Assert.Equal("membership-payment-action-removed", payload.GetProperty("type").GetString());
        }

        using (var secondMarkPayment = await SendBotRequestAsync(
                   client,
                   HttpMethod.Post,
                   $"/internal/bot/clients/{seeded.PaymentClientId}/membership/mark-payment",
                   new TelegramIdentityRequest("Telegram", seeded.AdminTelegramId),
                   idempotencyKey: "payment-idempotent"))
        {
            Assert.Equal(HttpStatusCode.Gone, secondMarkPayment.StatusCode);
            var payload = await ReadJsonElementAsync(secondMarkPayment);
            Assert.Equal("membership-payment-action-removed", payload.GetProperty("type").GetString());
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

        var accessDeniedAuditCount = await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == BotAuditConstants.BotAccessDeniedAction &&
            log.Source == "Bot" &&
            log.MessengerPlatform == "Telegram");
        Assert.Equal(1, accessDeniedAuditCount);
    }

    [Fact]
    public async Task Attendance_exception_releases_pending_idempotency_reservation()
    {
        await using var factory = new InternalBotAppFactory(throwAttendance: true);
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient();
        var request = new BotSaveAttendanceRequest(
            "Telegram",
            seeded.HeadCoachTelegramId,
            GetBusinessToday().ToString("yyyy-MM-dd"),
            [new BotAttendanceMarkRequest(seeded.CoachClientId, true)]);

        for (var attempt = 0; attempt < 2; attempt++)
        {
            using var response = await SendBotRequestAsync(
                client,
                HttpMethod.Post,
                $"/internal/bot/attendance/groups/{seeded.CoachGroupId}",
                request,
                idempotencyKey: "attendance-exception-release");
            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.False(await db.BotIdempotencyRecords.AnyAsync());
        }
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
        dbContext.Halls.RemoveRange(dbContext.Halls);
        dbContext.Branches.RemoveRange(dbContext.Branches);
        await dbContext.SaveChangesAsync();

        var passwordHashService = scope.ServiceProvider.GetRequiredService<Application.Security.IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        var today = GetBusinessToday();
        var sharedPassword = "internal-bot-password";

        var headCoach = CreateUser("bot-headcoach", "Bot HeadCoach", UserRole.HeadCoach, sharedPassword, passwordHashService, now, "tg-headcoach");
        var superAdministrator = CreateUser(
            "bot-superadministrator",
            "Bot SuperAdministrator",
            UserRole.SuperAdministrator,
            sharedPassword,
            passwordHashService,
            now,
            "tg-superadministrator");
        var administrator = CreateUser("bot-admin", "Bot Administrator", UserRole.Administrator, sharedPassword, passwordHashService, now, "tg-admin");
        var coach = CreateUser("bot-coach", "Bot Coach", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-coach");
        var inactiveCoach = CreateUser("bot-inactive", "Bot Inactive", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-inactive", isActive: false);
        var mustChangePasswordCoach = CreateUser("bot-password", "Bot Password", UserRole.Coach, sharedPassword, passwordHashService, now, "tg-password", mustChangePassword: true);

        var coachBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Bot Coach Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var adminBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Bot Admin Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = adminBranch.Id;
        var coachHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = coachBranch.Id,
            Name = "Bot Coach Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var adminHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = adminBranch.Id,
            Name = "Bot Admin Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Bot Default Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var coachGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = coachBranch.Id,
            HallId = coachHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Coach Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var adminGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = adminBranch.Id,
            HallId = adminHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Admin Group",
            TrainingStartTime = new TimeOnly(12, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var coachClient = CreateClient("Coach", "Client", "+79990000001", coachBranch.Id, now);
        var expiringTodayClient = CreateClient("Expiring", "Today", "+79990000002", adminBranch.Id, now);
        var expiringDayNineClient = CreateClient("Expiring", "Nine", "+79990000003", adminBranch.Id, now);
        var expiringDayTenClient = CreateClient("Expiring", "Ten", "+79990000004", adminBranch.Id, now);
        var expiringDayElevenClient = CreateClient("Expiring", "Eleven", "+79990000005", adminBranch.Id, now);
        var expiredClient = CreateClient("Expired", "Client", "+79990000006", adminBranch.Id, now);
        var paymentClient = CreateClient("Payment", "Client", "+79990000007", adminBranch.Id, now);
        var professionalPaymentClient = CreateClient("Professional", "Payment", "+79990000008", adminBranch.Id, now);

        dbContext.Users.AddRange(
            headCoach,
            superAdministrator,
            administrator,
            coach,
            inactiveCoach,
            mustChangePasswordCoach);
        dbContext.Branches.AddRange(coachBranch, adminBranch);
        dbContext.Halls.AddRange(coachHall, adminHall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(coachGroup, adminGroup);
        dbContext.Clients.AddRange(
            coachClient,
            expiringTodayClient,
            expiringDayNineClient,
            expiringDayTenClient,
            expiringDayElevenClient,
            expiredClient,
            paymentClient,
            professionalPaymentClient);
        dbContext.GroupTrainers.Add(new GroupTrainer { GroupId = coachGroup.Id, TrainerId = coach.Id });
        dbContext.ClientGroups.AddRange(
            new ClientGroup { ClientId = coachClient.Id, GroupId = coachGroup.Id, BranchId = coachBranch.Id },
            new ClientGroup { ClientId = expiringTodayClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = expiringDayNineClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = expiringDayTenClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = expiringDayElevenClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = expiredClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = paymentClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id },
            new ClientGroup { ClientId = professionalPaymentClient.Id, GroupId = adminGroup.Id, BranchId = adminBranch.Id });

        dbContext.ClientMemberships.AddRange(
            CreateMembership(coachClient.Id, coachBranch.Id, coachGroup.Id, coach.Id, today.AddDays(-1), today.AddDays(5), 1200m, now),
            CreateMembership(expiringTodayClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-10), today, 1500m, now),
            CreateMembership(expiringDayNineClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-10), today.AddDays(9), 1500m, now),
            CreateMembership(expiringDayTenClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-10), today.AddDays(10), 1500m, now),
            CreateMembership(expiringDayElevenClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-10), today.AddDays(11), 1500m, now),
            CreateMembership(expiredClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-20), today.AddDays(-1), 1500m, now),
            CreateMembership(paymentClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-3), today.AddDays(20), 1800m, now, amountOnly: true),
            CreateMembership(professionalPaymentClient.Id, adminBranch.Id, adminGroup.Id, administrator.Id, today.AddDays(-3), null, 0m, now, MembershipBehaviorKind.Professional));

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
            superAdministrator.Id,
            superAdministrator.MessengerPlatformUserId!,
            administrator.Id,
            administrator.MessengerPlatformUserId!,
            coach.MessengerPlatformUserId!,
            inactiveCoach.MessengerPlatformUserId!,
            mustChangePasswordCoach.MessengerPlatformUserId!,
            coachGroup.Id,
            adminGroup.Id,
            coachClient.Id,
            expiringTodayClient.Id,
            expiringDayNineClient.Id,
            expiringDayTenClient.Id,
            expiringDayElevenClient.Id,
            expiredClient.Id,
            paymentClient.Id,
            professionalPaymentClient.Id);
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

    private static Client CreateClient(string lastName, string firstName, string phone, Guid branchId, DateTimeOffset now)
    {
        return new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
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
        Guid branchId,
        Guid groupId,
        Guid changedByUserId,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal grossAmount,
        DateTimeOffset now,
        MembershipBehaviorKind behaviorKind = MembershipBehaviorKind.Term,
        bool amountOnly = false)
    {
        var saleId = Guid.NewGuid();
        var catalogItem = behaviorKind == MembershipBehaviorKind.Professional || amountOnly
            ? null
            : MembershipCatalogItem.CreateBranchOwned(
                branchId,
                $"Bot {behaviorKind} {clientId:N}",
                grossAmount,
                behaviorKind,
                purchaseDate,
                null,
                now);
        var catalogItemId = amountOnly
            ? (Guid?)null
            : catalogItem?.Id ?? MembershipCatalogItemConfiguration.ProfessionalCatalogItemId;
        var membershipId = Guid.NewGuid();
        var membership = new ClientMembership
        {
            Id = membershipId,
            ClientId = clientId,
            SaleId = saleId,
            BehaviorKind = behaviorKind,
            IndividualValidFrom = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : purchaseDate,
            IndividualValidTo = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : expirationDate,
            ProfessionalComment = behaviorKind == MembershipBehaviorKind.Professional ? "Bot professional" : null,
            SingleVisitUsed = false,
            ValidFrom = now,
            ValidTo = null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ChangedByUserId = changedByUserId,
            CreatedAt = now,
            Sale = new ClientMembershipSale
            {
                Id = saleId,
                ClientId = clientId,
                MembershipCatalogItemId = catalogItemId,
                BehaviorKind = behaviorKind,
                PricingMode = amountOnly
                    ? ClientMembershipSalePricingMode.AmountOnly
                    : ClientMembershipSalePricingMode.Catalog,
                PurchaseDate = purchaseDate,
                PaymentDate = purchaseDate,
                GrossAmount = grossAmount,
                CreatedByUserId = changedByUserId,
                CreatedAt = now,
                MembershipCatalogItem = catalogItem
            }
        };
        membership.TargetGroups.Add(new ClientMembershipTargetGroup
        {
            ClientMembershipId = membershipId,
            GroupId = groupId,
            BranchId = branchId,
            Position = 0
        });
        membership.Sale.TargetSnapshots.Add(new ClientMembershipSaleTargetSnapshot
        {
            SaleId = saleId,
            GroupId = groupId,
            BranchId = branchId,
            Position = 0
        });

        return membership;
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

    private static DateOnly GetBusinessToday()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
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
        Guid SuperAdministratorId,
        string SuperAdministratorTelegramId,
        Guid AdminId,
        string AdminTelegramId,
        string CoachTelegramId,
        string InactiveTelegramId,
        string MustChangePasswordTelegramId,
        Guid CoachGroupId,
        Guid AdminGroupId,
        Guid CoachClientId,
        Guid ExpiringTodayClientId,
        Guid ExpiringDayNineClientId,
        Guid ExpiringDayTenClientId,
        Guid ExpiringDayElevenClientId,
        Guid ExpiredClientId,
        Guid PaymentClientId,
        Guid ProfessionalPaymentClientId);

    private sealed class InternalBotAppFactory(bool throwAttendance = false) : WebApplicationFactory<Program>
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

                if (throwAttendance)
                {
                    services.RemoveAll<IAttendanceService>();
                    services.AddScoped<IAttendanceService, ThrowingAttendanceService>();
                }
            });
        }
    }

    private sealed class ThrowingAttendanceService : IAttendanceService
    {
        public Task<AttendanceBatchMutationResult> SaveAsync(
            SaveAttendanceCommand command,
            CancellationToken cancellationToken) =>
            throw new InvalidOperationException("Attendance mutation failed for idempotency test.");
    }
}
