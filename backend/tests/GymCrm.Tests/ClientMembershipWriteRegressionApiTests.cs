using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Application.Security;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class ClientMembershipWriteRegressionApiTests
{
    private static readonly JsonSerializerOptions IdempotencyJsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Task083_payment_date_policy_accepts_today_and_past_and_rejects_missing_and_future()
    {
        var businessDate = new DateOnly(2026, 7, 24);

        Assert.Equal(
            ClientMembershipPaymentDateValidationResult.Missing,
            ClientMembershipPaymentDatePolicy.Validate(null, businessDate));
        Assert.Equal(
            ClientMembershipPaymentDateValidationResult.Valid,
            ClientMembershipPaymentDatePolicy.Validate(businessDate, businessDate));
        Assert.Equal(
            ClientMembershipPaymentDateValidationResult.Valid,
            ClientMembershipPaymentDatePolicy.Validate(businessDate.AddYears(-20), businessDate));
        Assert.Equal(
            ClientMembershipPaymentDateValidationResult.Future,
            ClientMembershipPaymentDatePolicy.Validate(businessDate.AddDays(1), businessDate));
    }

    [Fact]
    public async Task Task083_PostgreSql_purchase_is_status_free_and_persists_sale_owned_payment_metadata()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        var paymentDate = context.Today.AddDays(-20);

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{paymentDate:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """,
            "task083-purchase-backdated");

        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);

        using var document = JsonDocument.Parse(body);
        var currentMembership = GetRequiredProperty(document.RootElement, "currentMembership");
        Assert.Equal(paymentDate.ToString("yyyy-MM-dd"), GetRequiredProperty(currentMembership, "paymentDate").GetString());
        Assert.Equal(context.ActorId, GetRequiredProperty(currentMembership, "paymentRecordedByUserId").GetGuid());
        Assert.Equal("TASK-078 Head Coach", GetRequiredProperty(currentMembership, "paymentRecordedByUserName").GetString());
        Assert.Equal(JsonValueKind.String, GetRequiredProperty(currentMembership, "paymentRecordedAt").ValueKind);
        Assert.False(currentMembership.TryGetProperty("isPaid", out _));
        Assert.False(currentMembership.TryGetProperty("paidAt", out _));

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertSingleSalePaymentDateAsync(paymentDate);
    }

    [Theory]
    [InlineData(null, "paymentDate")]
    [InlineData("not-a-date", "paymentDate")]
    public async Task Task083_PostgreSql_purchase_rejects_missing_or_malformed_payment_date_before_writes(
        string? paymentDate,
        string expectedField)
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        var paymentDateJson = paymentDate is null ? "null" : $"\"{paymentDate}\"";

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": {{paymentDateJson}},
              "professionalComment": null
            }
            """,
            $"task083-invalid-payment-date-{expectedField}-{Guid.NewGuid():N}");

        await AssertValidationProblemAsync(response, HttpStatusCode.BadRequest, expectedField);
        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(0);
    }

    [Fact]
    public async Task Task083_PostgreSql_purchase_rejects_future_and_negative_legacy_markers_before_reservation()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);

        using (var future = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today.AddDays(1):yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "task083-future-payment-date"))
        {
            await AssertValidationProblemAsync(future, HttpStatusCode.BadRequest, "paymentDate");
        }

        using (var unpaidStatus = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentStatus": "Unpaid",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "task083-legacy-unpaid-status"))
        {
            await AssertProblemAsync(unpaidStatus, HttpStatusCode.BadRequest, "membership-payment-status-removed");
        }

        using (var unpaidBoolean = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "isPaid": false,
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "task083-legacy-ispaid-false"))
        {
            await AssertProblemAsync(unpaidBoolean, HttpStatusCode.BadRequest, "membership-payment-status-removed");
        }

        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(0);
    }

    [Fact]
    public async Task Task083_PostgreSql_harmless_paid_marker_is_semantic_replay_of_status_free_purchase()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        var paymentDate = context.Today;
        const string idempotencyKey = "task083-harmless-paid-replay";

        using (var first = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{paymentDate:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var replay = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentStatus": "Paid",
                     "isPaid": true,
                     "paymentDate": "{{paymentDate:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Task083_PostgreSql_renewal_requires_status_free_payment_date_and_uses_new_sale()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        await context.SeedOpenMembershipVersionAsync(context.Today.AddDays(-30), context.Today.AddDays(-1), -20);
        var paymentDate = context.Today.AddDays(-7);

        using var response = await context.RenewAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "paymentDate": "{{paymentDate:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """,
            "task083-renew-backdated");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await context.AssertCountsAsync(expectedSales: 2, expectedMemberships: 2, expectedMembershipAudits: 1);
        await context.AssertLatestSalePaymentDateAsync(paymentDate);
    }

    [Fact]
    public async Task Task083_PostgreSql_correction_updates_sale_owned_payment_date_with_audit_and_replay()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "task083-correction-purchase"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var target = await context.LoadCurrentTargetAsync();
        var correctedPaymentDate = context.Today.AddDays(-14);
        var correctionPayload = $$"""
        {
          "saleId": "{{target.SaleId}}",
          "expectedMembershipId": "{{target.MembershipId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{correctedPaymentDate:yyyy-MM-dd}}"
        }
        """;

        using (var correction = await context.CorrectAsync(correctionPayload, "task083-payment-date-correction"))
        {
            Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        }

        using (var replay = await context.CorrectAsync(correctionPayload, "task083-payment-date-correction"))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 2, expectedMembershipAudits: 2);
        await context.AssertSingleSalePaymentDateAsync(correctedPaymentDate);
        await context.AssertMembershipSaleAuditContainsPaymentDateTransitionAsync(
            target.SaleId,
            context.Today,
            correctedPaymentDate);
    }

    [Fact]
    public async Task Task083_PostgreSql_correction_rejects_missing_malformed_and_future_payment_date_before_writes()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "task083-invalid-correction-purchase"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var target = await context.LoadCurrentTargetAsync();
        using (var missing = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{target.SaleId}}",
                     "expectedMembershipId": "{{target.MembershipId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}"
                   }
                   """,
                   "task083-correction-payment-date-missing"))
        {
            await AssertValidationProblemAsync(missing, HttpStatusCode.BadRequest, "paymentDate");
        }

        using (var malformed = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{target.SaleId}}",
                     "expectedMembershipId": "{{target.MembershipId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "not-a-date"
                   }
                   """,
                   "task083-correction-payment-date-malformed"))
        {
            await AssertValidationProblemAsync(malformed, HttpStatusCode.BadRequest, "paymentDate");
        }

        using (var future = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{target.SaleId}}",
                     "expectedMembershipId": "{{target.MembershipId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today.AddDays(1):yyyy-MM-dd}}"
                   }
                   """,
                   "task083-correction-payment-date-future"))
        {
            await AssertValidationProblemAsync(future, HttpStatusCode.BadRequest, "paymentDate");
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertSingleSalePaymentDateAsync(context.Today);
        await context.AssertMembershipSaleAuditCountAsync(0);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Task083_PostgreSql_sale_creating_transfer_requires_idempotency_and_rolls_back_payment_validation()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);

        using (var missingKey = await context.TransferAsync(
                   $$"""
                   {
                     "targetBranchId": "{{context.TargetBranchId}}",
                     "targetGroupIds": ["{{context.TargetGroupId}}"],
                     "membershipCatalogItemId": "{{context.TargetTermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   idempotencyKey: null))
        {
            await AssertValidationProblemAsync(missingKey, HttpStatusCode.BadRequest, "idempotencyKey");
        }

        using (var futurePayment = await context.TransferAsync(
                   $$"""
                   {
                     "targetBranchId": "{{context.TargetBranchId}}",
                     "targetGroupIds": ["{{context.TargetGroupId}}"],
                     "membershipCatalogItemId": "{{context.TargetTermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today.AddDays(1):yyyy-MM-dd}}"
                   }
                   """,
                   "task083-transfer-future-payment"))
        {
            await AssertValidationProblemAsync(futurePayment, HttpStatusCode.BadRequest, "paymentDate");
        }

        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(0);
        await context.AssertClientStillInSourceBranchAsync();
    }

    [Fact]
    public async Task Task083_PostgreSql_sale_creating_transfer_replay_and_conflict_do_not_duplicate_writes()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);
        const string idempotencyKey = "task083-transfer-replay";
        var payload = $$"""
        {
          "targetBranchId": "{{context.TargetBranchId}}",
          "targetGroupIds": ["{{context.TargetGroupId}}"],
          "membershipCatalogItemId": "{{context.TargetTermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}"
        }
        """;

        using (var first = await context.TransferAsync(payload, idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var replay = await context.TransferAsync(payload, idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        }

        using (var conflict = await context.TransferAsync(
                   $$"""
                   {
                     "targetBranchId": "{{context.TargetBranchId}}",
                     "targetGroupIds": ["{{context.TargetGroupId}}"],
                     "membershipCatalogItemId": "{{context.TargetTermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   idempotencyKey))
        {
            await AssertProblemAsync(conflict, HttpStatusCode.Conflict, "idempotency-conflict");
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Task123_PostgreSql_mandatory_membership_audit_failure_rolls_back_transfer_graph()
    {
        await using var context = await MembershipWriteContext.CreateAsync(
            usePostgreSql: true,
            throwMembershipAudit: true);

        using var response = await context.TransferAsync(
            $$"""
            {
              "targetBranchId": "{{context.TargetBranchId}}",
              "targetGroupIds": ["{{context.TargetGroupId}}"],
              "membershipCatalogItemId": "{{context.TargetTermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}"
            }
            """,
            "task123-transfer-audit-rollback");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(0);
        await context.AssertClientStillInSourceBranchAsync();

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await db.ClientGroups.AnyAsync(clientGroup =>
            clientGroup.ClientId == context.ClientId && clientGroup.GroupId == context.TargetGroupId));
        Assert.False(await db.ClientBranchAssignments.AnyAsync(assignment =>
            assignment.ClientId == context.ClientId && assignment.BranchId == context.TargetBranchId));
        Assert.False(await db.ClientGroupAssignments.AnyAsync(assignment =>
            assignment.ClientId == context.ClientId && assignment.GroupId == context.TargetGroupId));
    }

    [Fact]
    public async Task Membership_purchase_requires_idempotency_key_before_any_write()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """,
            idempotencyKey: null);

        await AssertValidationProblemAsync(response, HttpStatusCode.BadRequest, "idempotencyKey");
        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
    }

    [Fact]
    public async Task Addressed_correction_uses_target_version_and_preserves_sale_purchase_date_and_payment()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);

        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(59):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "purchase-correction-target"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var target = await context.LoadCurrentTargetAsync();
        var originalPurchaseDate = target.PurchaseDate;
        var editedFrom = context.Today.AddDays(2);
        var editedTo = context.Today.AddDays(40);

        using var correction = await context.CorrectAsync(
            $$"""
            {
              "saleId": "{{target.SaleId}}",
              "expectedMembershipId": "{{target.MembershipId}}",
              "validFrom": "{{editedFrom:yyyy-MM-dd}}",
              "validTo": "{{editedTo:yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}"
            }
            """,
            "correction-target-preserve-payment");

        var body = await correction.Content.ReadAsStringAsync();
        Assert.True(
            correction.StatusCode == HttpStatusCode.OK,
            $"Expected addressed correction to succeed. Status={(int)correction.StatusCode} {correction.StatusCode}. Body={body}");

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var sale = await db.ClientMembershipSales.AsNoTracking().SingleAsync(sale => sale.Id == target.SaleId);
        var versions = await db.ClientMemberships
            .AsNoTracking()
            .Where(membership => membership.SaleId == target.SaleId)
            .OrderBy(membership => membership.ValidFrom)
            .ToArrayAsync();

        Assert.Equal(originalPurchaseDate, sale.PurchaseDate);
        Assert.Equal(context.Today, sale.PaymentDate);
        Assert.Equal(2, versions.Length);
        Assert.Equal(target.MembershipId, versions[0].Id);
        Assert.NotNull(versions[0].ValidTo);
        Assert.Equal(editedFrom, versions[1].IndividualValidFrom);
        Assert.Equal(editedTo, versions[1].IndividualValidTo);
    }

    [Fact]
    public async Task Completed_idempotency_replay_reloads_result_without_duplicate_sale_version_or_audit()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        const string idempotencyKey = "purchase-replay-key";
        var body = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;

        using (var first = await context.PurchaseAsync(body, idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var replay = await context.PurchaseAsync(body, idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
    }

    [Fact]
    public async Task Idempotency_payload_is_normalized_before_hashing()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        const string idempotencyKey = "purchase-normalized-replay-key";

        using (var first = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": " {{context.Today:yyyy-MM-dd}} ",
                     "validTo": " {{context.Today.AddDays(29):yyyy-MM-dd}} ",
                     "paymentDate": " {{context.Today:yyyy-MM-dd}} ",
                     "professionalComment": null
                   }
                   """,
                   idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var replay = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Status_free_correction_then_mark_payment_tombstone_preserves_counts_and_idempotency()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);

        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "purchase-before-correct-and-tombstone"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var original = await context.LoadCurrentTargetAsync();
        using (var correction = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{original.SaleId}}",
                     "expectedMembershipId": "{{original.MembershipId}}",
                     "validFrom": "{{context.Today.AddDays(1):yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   "correct-before-payment-tombstone"))
        {
            Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        }

        var corrected = await context.LoadCurrentTargetAsync();
        const string paymentKey = "mark-payment-replay";
        var paymentPayload = $$"""{"saleId":"{{corrected.SaleId}}","expectedMembershipId":"{{corrected.MembershipId}}"}""";
        using (var payment = await context.MarkPaymentAsync(paymentPayload, paymentKey))
        {
            await AssertProblemAsync(payment, HttpStatusCode.Gone, "membership-payment-action-removed");
        }

        using (var replay = await context.MarkPaymentAsync(paymentPayload, paymentKey))
        {
            await AssertProblemAsync(replay, HttpStatusCode.Gone, "membership-payment-action-removed");
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 2, expectedMembershipAudits: 2);
        await context.AssertIdempotencyCountAsync(2);
    }

    [Fact]
    public async Task PostgreSql_overlap_violation_returns_stable_conflict_without_duplicate_write()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true);

        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(59):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "purchase-overlap-base"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        using var overlap = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today.AddDays(40):yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(69):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """,
            "purchase-overlap-conflict");

        await AssertProblemAsync(overlap, HttpStatusCode.Conflict, "membership-overlap");
        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
    }

    [Fact]
    public async Task Concurrent_overlapping_purchases_with_different_idempotency_keys_still_return_membership_overlap()
    {
        var saveChangesBarrier = new MembershipWriteSaveChangesBarrier();
        await using var context = await MembershipWriteContext.CreateAsync(
            usePostgreSql: true,
            saveChangesBarrier: saveChangesBarrier);

        var firstPayload = $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(59):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """;

        var secondPayload = $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today.AddDays(40):yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(69):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """;

        var firstRequest = context.PurchaseAsync(firstPayload, "purchase-overlap-race-first");
        var secondRequest = context.PurchaseAsync(secondPayload, "purchase-overlap-race-second");
        await saveChangesBarrier.WaitForTwoMembershipSaveAttemptsAsync();
        saveChangesBarrier.Release();

        using var first = await firstRequest;
        using var second = await secondRequest;

        var firstBody = await first.Content.ReadAsStringAsync();
        var secondBody = await second.Content.ReadAsStringAsync();

        Assert.NotEqual(first.StatusCode, second.StatusCode);
        Assert.Contains(first.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        Assert.Contains(second.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });

        var conflict = first.StatusCode == HttpStatusCode.Conflict ? first : second;
        await AssertProblemAsync(conflict, HttpStatusCode.Conflict, "membership-overlap");

        Assert.False(firstBody.Contains("23P01", StringComparison.OrdinalIgnoreCase));
        Assert.False(secondBody.Contains("23P01", StringComparison.OrdinalIgnoreCase));
        Assert.False(firstBody.Contains("constraint", StringComparison.OrdinalIgnoreCase));
        Assert.False(secondBody.Contains("constraint", StringComparison.OrdinalIgnoreCase));
        Assert.False(firstBody.Contains("Npgsql", StringComparison.OrdinalIgnoreCase));
        Assert.False(secondBody.Contains("Npgsql", StringComparison.OrdinalIgnoreCase));

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var idempotencyRecords = await db.ClientMembershipIdempotencyRecords
            .AsNoTracking()
            .Where(record => record.ActorUserId == context.ActorId)
            .ToListAsync();
        Assert.Single(idempotencyRecords);
        Assert.All(idempotencyRecords, record => Assert.Equal("Completed", record.Status));
    }

    [Fact]
    public async Task Mandatory_membership_audit_failure_rolls_back_relational_mutation()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true, throwMembershipAudit: true);

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """,
            "purchase-audit-rollback");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
        await context.AssertIdempotencyCountAsync(0);
    }

    [Fact]
    public async Task Correction_preserves_sale_payment_date_when_it_is_unchanged()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);

        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "purchase-paid-correction"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var paidBefore = await context.LoadCurrentMembershipAsync();
        Assert.Equal(context.Today, paidBefore.PaymentDate);

        using (var correction = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{paidBefore.SaleId}}",
                     "expectedMembershipId": "{{paidBefore.MembershipId}}",
                     "validFrom": "{{context.Today.AddDays(1):yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   "correct-paid-preserve-exact"))
        {
            Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        }

        var paidAfter = await context.LoadCurrentMembershipAsync();
        Assert.Equal(paidBefore.PaymentDate, paidAfter.PaymentDate);
    }

    [Fact]
    public async Task Addressed_correction_rejects_stale_expected_membership_id()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);

        using (var purchase = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   "purchase-stale-target"))
        {
            Assert.Equal(HttpStatusCode.OK, purchase.StatusCode);
        }

        var original = await context.LoadCurrentMembershipAsync();
        using (var correction = await context.CorrectAsync(
                   $$"""
                   {
                     "saleId": "{{original.SaleId}}",
                     "expectedMembershipId": "{{original.MembershipId}}",
                     "validFrom": "{{context.Today.AddDays(1):yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   "correct-stale-first"))
        {
            Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        }

        using var stale = await context.CorrectAsync(
            $$"""
            {
              "saleId": "{{original.SaleId}}",
              "expectedMembershipId": "{{original.MembershipId}}",
              "validFrom": "{{context.Today.AddDays(2):yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(31):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}"
            }
            """,
            "correct-stale-second");

        await AssertProblemAsync(stale, HttpStatusCode.Conflict, "membership-target-conflict");
    }

    [Fact]
    public async Task Same_idempotency_key_with_different_payload_conflicts_while_payment_tombstone_does_not_write()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        const string idempotencyKey = "idempotency-conflict-key";
        var firstPayload = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;

        using (var first = await context.PurchaseAsync(firstPayload, idempotencyKey))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var differentPayload = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(30):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """,
                   idempotencyKey))
        {
            await AssertProblemAsync(differentPayload, HttpStatusCode.Conflict, "idempotency-conflict");
        }

        var current = await context.LoadCurrentMembershipAsync();
        using var differentAction = await context.MarkPaymentAsync(
            $$"""{"saleId":"{{current.SaleId}}","expectedMembershipId":"{{current.MembershipId}}"}""",
            idempotencyKey);

        await AssertProblemAsync(differentAction, HttpStatusCode.Gone, "membership-payment-action-removed");
        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Seeded_pending_idempotency_returns_operation_in_progress()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        const string idempotencyKey = "seeded-pending-key";
        var payload = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;
        await context.SeedIdempotencyRecordAsync(
            idempotencyKey,
            "ClientMembershipPurchased",
            CreatePurchaseIdempotencyPayload(
                context.ClientId,
                context.Today,
                context.TermCatalogItemId,
                validTo: context.Today.AddDays(29)),
            "Pending",
            DateTimeOffset.UtcNow.AddMinutes(5));

        using var response = await context.PurchaseAsync(payload, idempotencyKey);

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "membership-operation-in-progress");
        await context.AssertCountsAsync(expectedSales: 0, expectedMemberships: 0, expectedMembershipAudits: 0);
    }

    [Fact]
    public async Task Expired_idempotency_key_can_be_reused_for_new_mutation()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        const string idempotencyKey = "expired-reusable-key";
        var payload = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;
        await context.SeedIdempotencyRecordAsync(
            idempotencyKey,
            "ClientMembershipPurchased",
            CreatePurchaseIdempotencyPayload(
                context.ClientId,
                context.Today,
                context.TermCatalogItemId,
                validTo: context.Today.AddDays(29)),
            "Completed",
            DateTimeOffset.UtcNow.AddMinutes(-1));

        using var response = await context.PurchaseAsync(payload, idempotencyKey);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Concurrent_identical_PostgreSql_idempotency_exposes_pending_and_does_not_duplicate()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: true, blockMembershipAudit: true);
        const string idempotencyKey = "pg-concurrent-identical-key";
        var payload = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;

        var firstTask = context.PurchaseAsync(payload, idempotencyKey);
        await context.WaitForPendingIdempotencyAsync(idempotencyKey, firstTask);
        using var second = await context.PurchaseAsync(payload, idempotencyKey);
        context.ReleaseBlockedMembershipAudit();
        using var first = await firstTask;

        var firstBody = await first.Content.ReadAsStringAsync();
        Assert.True(first.StatusCode == HttpStatusCode.OK, firstBody);
        await AssertProblemAsync(second, HttpStatusCode.Conflict, "membership-operation-in-progress");
        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Concurrent_identical_PostgreSql_reservation_collision_uses_stable_unique_index_mapping()
    {
        var saveChangesBarrier = new MembershipWriteSaveChangesBarrier();
        await using var context = await MembershipWriteContext.CreateAsync(
            usePostgreSql: true,
            blockMembershipAudit: true,
            saveChangesBarrier: saveChangesBarrier);
        const string idempotencyKey = "pg-concurrent-reservation-collision";
        var payload = $$"""
        {
          "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
          "validFrom": "{{context.Today:yyyy-MM-dd}}",
          "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
          "paymentDate": "{{context.Today:yyyy-MM-dd}}",
          "professionalComment": null
        }
        """;

        var firstTask = context.PurchaseAsync(payload, idempotencyKey);
        var secondTask = context.PurchaseAsync(payload, idempotencyKey);
        await context.WaitForTwoMembershipSaveAttemptsAsync();
        saveChangesBarrier.Release();

        var conflictTask = await Task.WhenAny(firstTask, secondTask);
        using (var conflict = await conflictTask)
        {
            await AssertProblemAsync(
                conflict,
                HttpStatusCode.Conflict,
                "membership-operation-in-progress");
        }

        context.ReleaseBlockedMembershipAudit();
        var successTask = ReferenceEquals(conflictTask, firstTask) ? secondTask : firstTask;
        using (var success = await successTask)
        {
            Assert.Equal(HttpStatusCode.OK, success.StatusCode);
        }

        await context.AssertCountsAsync(expectedSales: 1, expectedMemberships: 1, expectedMembershipAudits: 1);
        await context.AssertIdempotencyCountAsync(1);
    }

    [Fact]
    public async Task Current_membership_selection_is_consistent_for_details_service_and_renewal()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        var expired = await context.SeedOpenMembershipVersionAsync(
            context.Today.AddDays(-60),
            context.Today.AddDays(-31),
            createdAtOffsetMinutes: -3);
        var active = await context.SeedOpenMembershipVersionAsync(
            context.Today.AddDays(-1),
            context.Today.AddDays(5),
            createdAtOffsetMinutes: -2);
        var earlierFuture = await context.SeedOpenMembershipVersionAsync(
            context.Today.AddDays(10),
            context.Today.AddDays(20),
            createdAtOffsetMinutes: -1);
        var selectedFuture = await context.SeedOpenMembershipVersionAsync(
            context.Today.AddDays(30),
            context.Today.AddDays(40),
            createdAtOffsetMinutes: 0);

        using (var response = await context.GetClientAsync())
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var currentMembership = GetRequiredProperty(document.RootElement, "currentMembership");
            Assert.Equal(selectedFuture.MembershipId, Guid.Parse(GetRequiredProperty(currentMembership, "id").GetString()!));
        }

        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IClientMembershipService>();
            var details = await service.GetAsync(context.ClientId, CancellationToken.None);
            Assert.NotNull(details);
            Assert.Equal(selectedFuture.MembershipId, details.CurrentMembership?.Id);
        }

        using (var renewal = await context.RenewAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}"
                   }
                   """,
                   "renew-selected-current"))
        {
            Assert.Equal(HttpStatusCode.OK, renewal.StatusCode);
        }

        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var selectedAfterRenewal = await db.ClientMemberships.AsNoTracking()
                .SingleAsync(membership => membership.Id == selectedFuture.MembershipId);
            Assert.Null(selectedAfterRenewal.ValidTo);
            Assert.Equal(5, await db.ClientMemberships.CountAsync(membership => membership.ClientId == context.ClientId));
            Assert.Contains(
                await db.ClientMemberships.AsNoTracking().Where(membership => membership.ClientId == context.ClientId).ToArrayAsync(),
                membership =>
                    membership.Id != expired.MembershipId &&
                    membership.Id != active.MembershipId &&
                    membership.Id != earlierFuture.MembershipId &&
                    membership.Id != selectedFuture.MembershipId &&
                    membership.ChangeReason == ClientMembershipChangeReason.Renewal);
        }
    }

    [Fact]
    public async Task Facade_contract_delegates_all_membership_operations_without_cross_scope_state()
    {
        await using var context = await MembershipWriteContext.CreateAsync(usePostgreSql: false);
        Guid saleId;
        Guid membershipId;
        Guid refundId;

        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IClientMembershipService>();
            var missing = await service.GetAsync(Guid.NewGuid(), CancellationToken.None);
            Assert.Null(missing);

            var invalidPurchase = await service.PurchaseAsync(
                Guid.Empty,
                new CreateClientMembershipPurchaseCommand(
                    context.ActorId,
                    context.TermCatalogItemId,
                    context.Today,
                    context.Today.AddDays(29),
                    context.Today,
                    ProfessionalComment: null),
                CancellationToken.None);
            Assert.Equal(ClientMembershipMutationError.InvalidRequest, invalidPurchase.Error);

            var purchase = await service.PurchaseAsync(
                context.ClientId,
                new CreateClientMembershipPurchaseCommand(
                    context.ActorId,
                    context.TermCatalogItemId,
                    context.Today,
                    context.Today.AddDays(29),
                    context.Today,
                    ProfessionalComment: null),
                CancellationToken.None);
            Assert.True(purchase.Succeeded, purchase.Error.ToString());
            var purchasedMembership = purchase.Details!.CurrentMembership!;
            saleId = purchasedMembership.SaleId;
            membershipId = purchasedMembership.Id;
        }

        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IClientMembershipService>();
            var details = await service.GetAsync(context.ClientId, CancellationToken.None);
            Assert.Equal(membershipId, details?.CurrentMembership?.Id);

            var comment = await service.UpdateCommentAsync(
                context.ClientId,
                saleId,
                new UpdateClientMembershipCommentCommand(context.ActorId, "  facade comment  "),
                CancellationToken.None);
            Assert.True(comment.Found);
            Assert.Equal("set", comment.Transition);

            var correction = await service.CorrectAsync(
                context.ClientId,
                new CorrectClientMembershipCommand(
                    context.ActorId,
                    saleId,
                    membershipId,
                    context.Today,
                    context.Today.AddDays(29),
                    context.Today.AddDays(-1)),
                CancellationToken.None);
            Assert.True(correction.Succeeded, correction.Error.ToString());

            var refund = await service.RegisterRefundAsync(
                context.ClientId,
                new RegisterClientMembershipRefundCommand(
                    context.ActorId,
                    saleId,
                    context.Today,
                    100m,
                    "facade refund"),
                CancellationToken.None);
            Assert.True(refund.Succeeded, refund.Error.ToString());
            refundId = refund.Refund!.Id;
        }

        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IClientMembershipService>();
            var cancel = await service.CancelRefundAsync(
                context.ClientId,
                new CancelClientMembershipRefundCommand(context.ActorId, refundId),
                CancellationToken.None);
            Assert.True(cancel.Succeeded, cancel.Error.ToString());

            var repeatedCancel = await service.CancelRefundAsync(
                context.ClientId,
                new CancelClientMembershipRefundCommand(context.ActorId, refundId),
                CancellationToken.None);
            Assert.Equal(ClientMembershipRefundMutationError.RefundAlreadyCanceled, repeatedCancel.Error);

            var renewal = await service.RenewAsync(
                context.ClientId,
                new RenewClientMembershipCommand(
                    context.ActorId,
                    context.TermCatalogItemId,
                    context.Today,
                    ProfessionalComment: null),
                CancellationToken.None);
            Assert.True(renewal.Succeeded, renewal.Error.ToString());
        }

        var singleVisit = await context.SeedSingleVisitClientAsync();
        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IClientMembershipService>();
            var singleVisitPurchase = await service.PurchaseAsync(
                singleVisit.ClientId,
                new CreateClientMembershipPurchaseCommand(
                    context.ActorId,
                    singleVisit.CatalogItemId,
                    ValidFrom: null,
                    ValidTo: null,
                    context.Today,
                    ProfessionalComment: null),
                CancellationToken.None);
            Assert.True(singleVisitPurchase.Succeeded, singleVisitPurchase.Error.ToString());

            var writeOff = await service.WriteOffSingleVisitAsync(
                singleVisit.ClientId,
                new WriteOffSingleVisitCommand(context.ActorId, context.Today),
                CancellationToken.None);
            Assert.True(writeOff.Applied);

            var restore = await service.RestoreSingleVisitAsync(
                singleVisit.ClientId,
                new RestoreSingleVisitCommand(
                    context.ActorId,
                    writeOff.CurrentMembership!.SaleId,
                    writeOff.CurrentMembership.Id),
                CancellationToken.None);
            Assert.True(restore.Applied);

            var conflictingRestore = await service.RestoreSingleVisitAsync(
                singleVisit.ClientId,
                new RestoreSingleVisitCommand(
                    context.ActorId,
                    writeOff.CurrentMembership.SaleId,
                    writeOff.CurrentMembership.Id),
                CancellationToken.None);
            Assert.Equal(SingleVisitRestoreStatus.Conflict, conflictingRestore.Status);
        }
    }

    private static async Task AssertValidationProblemAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string expectedField)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(body);
        var errors = GetRequiredProperty(document.RootElement, "errors");
        Assert.True(errors.TryGetProperty(expectedField, out _), body);
    }

    private static async Task AssertProblemAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string expectedType)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.StatusCode == expectedStatus,
            $"Expected {(int)expectedStatus} {expectedStatus}, got {(int)response.StatusCode} {response.StatusCode}. Body={body}");
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(body);
        Assert.Equal(expectedType, GetRequiredProperty(document.RootElement, "type").GetString());
    }

    private static JsonElement GetRequiredProperty(JsonElement element, string propertyName)
    {
        Assert.True(
            element.TryGetProperty(propertyName, out var value),
            $"Expected JSON property '{propertyName}' in {element.GetRawText()}.");
        return value;
    }

    private static object CreatePurchaseIdempotencyPayload(
        Guid clientId,
        DateOnly validFrom,
        Guid catalogItemId,
        DateOnly? validTo)
    {
        return new
        {
            ClientId = clientId,
            Action = "ClientMembershipPurchased",
            MembershipCatalogItemId = catalogItemId,
            ValidFrom = validFrom.ToString("yyyy-MM-dd"),
            ValidTo = validTo?.ToString("yyyy-MM-dd"),
            PaymentDate = validFrom.ToString("yyyy-MM-dd"),
            ProfessionalComment = (string?)null,
            ManualSaleAmount = (decimal?)null
        };
    }

    private static string ComputeIdempotencyPayloadHash(object payload)
    {
        var json = JsonSerializer.Serialize(payload, IdempotencyJsonOptions);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    private sealed class MembershipWriteContext : IAsyncDisposable
    {
        private MembershipWriteContext(
            MembershipWriteAppFactory factory,
            PostgreSqlContainer? postgreSqlContainer,
            HttpClient httpClient,
            Guid actorId,
            Guid clientId,
            Guid termCatalogItemId,
            Guid targetBranchId,
            Guid targetGroupId,
            Guid targetTermCatalogItemId,
            DateOnly today,
            string csrfToken,
            MembershipAuditBlocker? auditBlocker,
            MembershipWriteSaveChangesBarrier? saveChangesBarrier)
        {
            Factory = factory;
            postgreSql = postgreSqlContainer;
            HttpClient = httpClient;
            ActorId = actorId;
            ClientId = clientId;
            TermCatalogItemId = termCatalogItemId;
            TargetBranchId = targetBranchId;
            TargetGroupId = targetGroupId;
            TargetTermCatalogItemId = targetTermCatalogItemId;
            Today = today;
            CsrfToken = csrfToken;
            this.auditBlocker = auditBlocker;
            this.saveChangesBarrier = saveChangesBarrier;
        }

        private readonly PostgreSqlContainer? postgreSql;
        private readonly MembershipAuditBlocker? auditBlocker;
        private readonly MembershipWriteSaveChangesBarrier? saveChangesBarrier;

        public MembershipWriteAppFactory Factory { get; }
        public HttpClient HttpClient { get; }
        public Guid ActorId { get; }
        public Guid ClientId { get; }
        public Guid TermCatalogItemId { get; }
        public Guid TargetBranchId { get; }
        public Guid TargetGroupId { get; }
        public Guid TargetTermCatalogItemId { get; }
        public DateOnly Today { get; }
        private string CsrfToken { get; }

        public static async Task<MembershipWriteContext> CreateAsync(
            bool usePostgreSql,
            bool throwMembershipAudit = false,
            bool blockMembershipAudit = false,
            MembershipWriteSaveChangesBarrier? saveChangesBarrier = null)
        {
            PostgreSqlContainer? postgreSql = null;
            string? connectionString = null;
            if (usePostgreSql)
            {
                postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
                    .WithDatabase($"gym_crm_task078_{Guid.NewGuid():N}")
                    .WithUsername("gym_crm")
                    .WithPassword("gym_crm")
                    .Build();
                await postgreSql.StartAsync();
                connectionString = postgreSql.GetConnectionString();
            }

            var auditBlocker = blockMembershipAudit ? new MembershipAuditBlocker() : null;
            var factory = new MembershipWriteAppFactory(
                connectionString,
                throwMembershipAudit,
                auditBlocker,
                saveChangesBarrier);
            var httpClient = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });

            try
            {
                var seeded = await SeedAsync(factory, usePostgreSql);
                var csrfToken = await LoginAsync(httpClient, seeded.Login, seeded.Password);
                return new MembershipWriteContext(
                    factory,
                    postgreSql,
                    httpClient,
                    seeded.ActorId,
                    seeded.ClientId,
                    seeded.TermCatalogItemId,
                    seeded.TargetBranchId,
                    seeded.TargetGroupId,
                    seeded.TargetTermCatalogItemId,
                    seeded.Today,
                    csrfToken,
                    auditBlocker,
                    saveChangesBarrier);
            }
            catch
            {
                httpClient.Dispose();
                await factory.DisposeAsync();
                if (postgreSql is not null)
                {
                    await postgreSql.DisposeAsync();
                }

                throw;
            }
        }

        public Task<HttpResponseMessage> PurchaseAsync(string rawJson, string? idempotencyKey) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/purchase", rawJson, CsrfToken, idempotencyKey);

        public Task<HttpResponseMessage> RenewAsync(string rawJson, string? idempotencyKey) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/renew", rawJson, CsrfToken, idempotencyKey);

        public Task<HttpResponseMessage> CorrectAsync(string rawJson, string? idempotencyKey) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/correct", rawJson, CsrfToken, idempotencyKey);

        public Task<HttpResponseMessage> MarkPaymentAsync(string rawJson, string? idempotencyKey) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/mark-payment", rawJson, CsrfToken, idempotencyKey);

        public Task<HttpResponseMessage> TransferAsync(string rawJson, string? idempotencyKey) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/transfer", rawJson, CsrfToken, idempotencyKey);

        public Task<HttpResponseMessage> GetClientAsync() =>
            HttpClient.GetAsync($"/clients/{ClientId}");

        public void ReleaseBlockedMembershipAudit()
        {
            auditBlocker?.Release();
        }

        public async Task WaitForTwoMembershipSaveAttemptsAsync()
        {
            if (saveChangesBarrier is null)
            {
                return;
            }

            var reachedTwo = saveChangesBarrier.WaitForTwoMembershipSaveAttemptsAsync();
            var timeout = Task.Delay(TimeSpan.FromSeconds(15));
            if (await Task.WhenAny(reachedTwo, timeout) != reachedTwo)
            {
                throw new TimeoutException("Timed out waiting for concurrent membership save attempts.");
            }
        }

        public async Task<MembershipSnapshot> LoadCurrentMembershipAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMemberships
                .AsNoTracking()
                .Where(membership => membership.ClientId == ClientId && membership.ValidTo == null)
                .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
                .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Select(membership => new MembershipSnapshot(
                    membership.Id,
                    membership.SaleId,
                    membership.Sale.PurchaseDate,
                    membership.Sale.PaymentDate))
                .FirstAsync();
        }

        public async Task<MembershipTarget> LoadCurrentTargetAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMemberships
                .AsNoTracking()
                .Where(membership => membership.ClientId == ClientId && membership.ValidTo == null)
                .Select(membership => new MembershipTarget(
                    membership.Id,
                    membership.SaleId,
                    membership.Sale.PurchaseDate))
                .SingleAsync();
        }

        public async Task SeedIdempotencyRecordAsync(
            string idempotencyKey,
            string actionType,
            object payload,
            string status,
            DateTimeOffset expiresAt)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var timestamp = DateTimeOffset.UtcNow.AddMinutes(-10);
            db.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
            {
                Id = Guid.NewGuid(),
                ActorUserId = ActorId,
                IdempotencyKey = idempotencyKey,
                ActionType = actionType,
                PayloadHash = ComputeIdempotencyPayloadHash(payload),
                Status = status,
                ClientId = ClientId,
                CreatedAt = timestamp,
                UpdatedAt = timestamp,
                ExpiresAt = expiresAt
            });
            await db.SaveChangesAsync();
        }

        public async Task WaitForPendingIdempotencyAsync(
            string idempotencyKey,
            Task<HttpResponseMessage>? inFlightRequest = null)
        {
            var deadline = DateTimeOffset.UtcNow.AddSeconds(10);
            while (DateTimeOffset.UtcNow < deadline)
            {
                if (inFlightRequest is not null && inFlightRequest.IsCompleted)
                {
                    using var response = await inFlightRequest;
                    var body = await response.Content.ReadAsStringAsync();
                    throw new Xunit.Sdk.XunitException(
                        $"Request completed before pending reservation was observed. Status={(int)response.StatusCode} {response.StatusCode}. Body={body}");
                }

                await using (var scope = Factory.Services.CreateAsyncScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                    if (await db.ClientMembershipIdempotencyRecords.AsNoTracking().AnyAsync(
                            record =>
                                record.ActorUserId == ActorId &&
                                record.IdempotencyKey == idempotencyKey &&
                                record.Status == "Pending"))
                    {
                        return;
                    }
                }

                await Task.Delay(25);
            }

            throw new TimeoutException("Timed out waiting for pending membership idempotency reservation.");
        }

        public async Task<MembershipTarget> SeedOpenMembershipVersionAsync(
            DateOnly validFrom,
            DateOnly validTo,
            int createdAtOffsetMinutes)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = scope.ServiceProvider.GetRequiredService<TimeProvider>()
                .GetUtcNow()
                .AddMinutes(createdAtOffsetMinutes);
            var sale = new ClientMembershipSale
            {
                Id = Guid.NewGuid(),
                ClientId = ClientId,
                MembershipCatalogItemId = TermCatalogItemId,
                BehaviorKind = MembershipBehaviorKind.Term,
                PricingMode = ClientMembershipSalePricingMode.Catalog,
                PurchaseDate = validFrom,
                PaymentDate = validFrom,
                GrossAmount = 1500m,
                CreatedByUserId = ActorId,
                CreatedAt = now
            };
            var membership = new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = ClientId,
                SaleId = sale.Id,
                BehaviorKind = MembershipBehaviorKind.Term,
                IndividualValidFrom = validFrom,
                IndividualValidTo = validTo,
                SingleVisitUsed = false,
                ValidFrom = now,
                ValidTo = null,
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ChangedByUserId = ActorId,
                CreatedAt = now
            };

            db.ClientMembershipSales.Add(sale);
            db.ClientMemberships.Add(membership);
            await db.SaveChangesAsync();
            return new MembershipTarget(membership.Id, sale.Id, sale.PurchaseDate);
        }

        public async Task<SingleVisitSeed> SeedSingleVisitClientAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow();
            var branchId = await db.Clients
                .AsNoTracking()
                .Where(client => client.Id == ClientId)
                .Select(client => client.BranchId)
                .SingleAsync();
            var singleVisitClient = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = branchId,
                LastName = "TASK-125",
                FirstName = "Single Visit",
                Phone = $"+79{Random.Shared.NextInt64(100_000_000, 999_999_999)}",
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };
            var singleVisitCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                branchId,
                "TASK-125 Single Visit",
                500m,
                MembershipBehaviorKind.SingleVisit,
                Today.AddYears(-1),
                null,
                now);

            db.Clients.Add(singleVisitClient);
            db.MembershipCatalogItems.Add(singleVisitCatalogItem);
            await db.SaveChangesAsync();
            return new SingleVisitSeed(singleVisitClient.Id, singleVisitCatalogItem.Id);
        }

        public async Task AssertCountsAsync(int expectedSales, int expectedMemberships, int expectedMembershipAudits)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(expectedSales, await db.ClientMembershipSales.CountAsync(sale => sale.ClientId == ClientId));
            Assert.Equal(expectedMemberships, await db.ClientMemberships.CountAsync(membership => membership.ClientId == ClientId));
            Assert.Equal(
                expectedMembershipAudits,
                await db.AuditLogs.CountAsync(log => log.EntityType == "ClientMembership"));
        }

        public async Task AssertIdempotencyCountAsync(int expected)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(
                expected,
                await db.ClientMembershipIdempotencyRecords.CountAsync(record => record.ActorUserId == ActorId));
        }

        public async Task AssertSingleSalePaymentDateAsync(DateOnly expectedPaymentDate)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var paymentDate = await db.ClientMembershipSales
                .AsNoTracking()
                .Where(sale => sale.ClientId == ClientId)
                .Select(sale => EF.Property<DateOnly>(sale, "PaymentDate"))
                .SingleAsync();
            Assert.Equal(expectedPaymentDate, paymentDate);
        }

        public async Task AssertLatestSalePaymentDateAsync(DateOnly expectedPaymentDate)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var paymentDate = await db.ClientMembershipSales
                .AsNoTracking()
                .Where(sale => sale.ClientId == ClientId)
                .OrderByDescending(sale => sale.CreatedAt)
                .Select(sale => EF.Property<DateOnly>(sale, "PaymentDate"))
                .FirstAsync();
            Assert.Equal(expectedPaymentDate, paymentDate);
        }

        public async Task AssertMembershipSaleAuditContainsPaymentDateTransitionAsync(
            Guid saleId,
            DateOnly oldPaymentDate,
            DateOnly newPaymentDate)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var audit = await db.AuditLogs
                .AsNoTracking()
                .SingleAsync(log =>
                    log.EntityType == "ClientMembershipSale" &&
                    log.EntityId == saleId.ToString() &&
                    log.ActionType == "ClientMembershipSaleCorrected");

            Assert.Contains(oldPaymentDate.ToString("yyyy-MM-dd"), audit.OldValueJson, StringComparison.Ordinal);
            Assert.Contains(newPaymentDate.ToString("yyyy-MM-dd"), audit.NewValueJson, StringComparison.Ordinal);
            Assert.Contains("paymentDate", audit.NewValueJson, StringComparison.OrdinalIgnoreCase);
        }

        public async Task AssertMembershipSaleAuditCountAsync(int expected)
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(
                expected,
                await db.AuditLogs.CountAsync(log => log.EntityType == "ClientMembershipSale"));
        }

        public async Task AssertClientStillInSourceBranchAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var branchId = await db.Clients
                .AsNoTracking()
                .Where(client => client.Id == ClientId)
                .Select(client => client.BranchId)
                .SingleAsync();
            Assert.NotEqual(TargetBranchId, branchId);
        }

        public async ValueTask DisposeAsync()
        {
            HttpClient.Dispose();
            await Factory.DisposeAsync();
            if (postgreSql is not null)
            {
                await postgreSql.DisposeAsync();
            }
        }

        private static async Task<SeededData> SeedAsync(MembershipWriteAppFactory factory, bool usePostgreSql)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            if (usePostgreSql)
            {
                await db.Database.MigrateAsync();
            }

            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();
            var businessDateProvider = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>();
            var now = timeProvider.GetUtcNow();
            var today = businessDateProvider.Today;
            var password = "membership-write-password";
            var branch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "TASK-078 branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "TASK-083 target branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = targetBranch.Id,
                Name = "TASK-083 target hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetGroupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "TASK-083 target group type",
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = targetBranch.Id,
                HallId = targetHall.Id,
                GroupTypeId = targetGroupType.Id,
                Name = "TASK-083 target group",
                TrainingStartTime = new TimeOnly(10, 0),
                DurationMinutes = 60,
                Weekdays = [1, 3],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var actor = new User
            {
                Id = Guid.NewGuid(),
                FullName = "TASK-078 Head Coach",
                Login = $"task078-headcoach-{Guid.NewGuid():N}",
                Role = UserRole.HeadCoach,
                MustChangePassword = false,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            actor.PasswordHash = passwordHashService.HashPassword(actor, password);
            var client = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                LastName = "TASK-078",
                FirstName = "Client",
                Phone = $"+79{Random.Shared.NextInt64(100_000_000, 999_999_999)}",
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };
            var termCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                branch.Id,
                "TASK-078 Term",
                1500m,
                MembershipBehaviorKind.Term,
                today.AddYears(-1),
                null,
                now);
            var targetTermCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                targetBranch.Id,
                "TASK-083 Target Term",
                1700m,
                MembershipBehaviorKind.Term,
                today.AddYears(-1),
                null,
                now);

            db.Branches.AddRange(branch, targetBranch);
            db.Halls.Add(targetHall);
            db.GroupTypes.Add(targetGroupType);
            db.TrainingGroups.Add(targetGroup);
            db.Users.Add(actor);
            db.Clients.Add(client);
            db.MembershipCatalogItems.AddRange(termCatalogItem, targetTermCatalogItem);
            await db.SaveChangesAsync();

            return new SeededData(
                actor.Id,
                actor.Login,
                password,
                client.Id,
                termCatalogItem.Id,
                targetBranch.Id,
                targetGroup.Id,
                targetTermCatalogItem.Id,
                today);
        }

        private static async Task<string> LoginAsync(HttpClient httpClient, string login, string password)
        {
            using var initialSessionResponse = await httpClient.GetAsync("/auth/session");
            Assert.Equal(HttpStatusCode.OK, initialSessionResponse.StatusCode);
            using var initialSessionDocument = JsonDocument.Parse(await initialSessionResponse.Content.ReadAsStringAsync());
            var csrfToken = GetRequiredProperty(initialSessionDocument.RootElement, "csrfToken").GetString();
            Assert.False(string.IsNullOrWhiteSpace(csrfToken));

            using var loginResponse = await SendRawJsonAsync(
                httpClient,
                HttpMethod.Post,
                "/auth/login",
                $$"""{"login":"{{login}}","password":"{{password}}"}""",
                csrfToken!,
                idempotencyKey: null);
            var body = await loginResponse.Content.ReadAsStringAsync();
            Assert.True(loginResponse.StatusCode == HttpStatusCode.OK, body);
            using var loginDocument = JsonDocument.Parse(body);
            return GetRequiredProperty(loginDocument.RootElement, "csrfToken").GetString()
                ?? throw new Xunit.Sdk.XunitException("Authenticated session did not return a CSRF token.");
        }

        private sealed record SeededData(
            Guid ActorId,
            string Login,
            string Password,
            Guid ClientId,
            Guid TermCatalogItemId,
            Guid TargetBranchId,
            Guid TargetGroupId,
            Guid TargetTermCatalogItemId,
            DateOnly Today);
    }

    private static async Task<HttpResponseMessage> SendRawJsonAsync(
        HttpClient httpClient,
        HttpMethod method,
        string path,
        string rawJson,
        string csrfToken,
        string? idempotencyKey)
    {
        using var request = new HttpRequestMessage(method, path)
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        return await httpClient.SendAsync(request);
    }

    private sealed record MembershipTarget(Guid MembershipId, Guid SaleId, DateOnly PurchaseDate);

    private sealed record MembershipSnapshot(
        Guid MembershipId,
        Guid SaleId,
        DateOnly PurchaseDate,
        DateOnly PaymentDate);

    private sealed record SingleVisitSeed(Guid ClientId, Guid CatalogItemId);

    private sealed class MembershipWriteAppFactory(
        string? postgresConnectionString,
        bool throwMembershipAudit,
        MembershipAuditBlocker? auditBlocker = null,
        MembershipWriteSaveChangesBarrier? saveChangesBarrier = null) : WebApplicationFactory<Program>
    {
        private static readonly DateTimeOffset FixedUtcNow = new(2026, 7, 24, 12, 0, 0, TimeSpan.Zero);

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = postgresConnectionString ??
                        "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = postgresConnectionString is null ? "false" : "true",
                    ["BootstrapUser:Login"] = "task078-bootstrap",
                    ["BootstrapUser:FullName"] = "TASK-078 Bootstrap",
                    ["ClientPhoto:StorageRootPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-task078-tests-{Guid.NewGuid():N}"),
                    ["TechnicalLogging:DirectoryPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-task078-technical-{Guid.NewGuid():N}")
                }));

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();

                if (postgresConnectionString is null)
                {
                    var databaseName = $"gym-crm-task078-tests-{Guid.NewGuid():N}";
                    var provider = new ServiceCollection()
                        .AddEntityFrameworkInMemoryDatabase()
                        .BuildServiceProvider();
                    services.AddDbContext<GymCrmDbContext>(options =>
                        options
                            .UseInMemoryDatabase(databaseName)
                            .UseInternalServiceProvider(provider));
                }
                else
                {
                    services.AddDbContext<GymCrmDbContext>(options =>
                    {
                        options.UseNpgsql(postgresConnectionString);
                        if (saveChangesBarrier is not null)
                        {
                            options.AddInterceptors(saveChangesBarrier);
                        }
                    });
                }

                if (throwMembershipAudit)
                {
                    services.RemoveAll<IAuditLogService>();
                    services.AddScoped<IAuditLogService, ThrowingMembershipAuditLogService>();
                }
                else if (auditBlocker is not null)
                {
                    services.RemoveAll<IAuditLogService>();
                    services.AddSingleton(auditBlocker);
                    services.AddScoped<IAuditLogService, BlockingMembershipAuditLogService>();
                }

                if (saveChangesBarrier is not null)
                {
                    services.AddSingleton(saveChangesBarrier);
                }

                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(new FixedTimeProvider(FixedUtcNow));
            });
        }

        private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
        {
            public override DateTimeOffset GetUtcNow() => utcNow;
        }
    }

    private sealed class MembershipWriteSaveChangesBarrier : SaveChangesInterceptor
    {
        private readonly TaskCompletionSource waitForSecondMembershipSaveAttempt = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int membershipSaveAttempts;

        public Task WaitForTwoMembershipSaveAttemptsAsync()
        {
            return waitForSecondMembershipSaveAttempt.Task;
        }

        public void Release()
        {
            release.TrySetResult();
        }

        private static bool IsMembershipMutationSaveAttempt(GymCrmDbContext? context)
        {
            if (context is null)
            {
                return false;
            }

            return context.ChangeTracker.Entries()
                .Any(entry =>
                    entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted &&
                    (entry.Entity is ClientMembershipSale ||
                     entry.Entity is ClientMembership ||
                     entry.Entity is ClientMembershipIdempotencyRecord));
        }

        private async ValueTask BlockForFirstTwoMembershipSavesAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref membershipSaveAttempts) <= 2)
            {
                if (membershipSaveAttempts == 2)
                {
                    waitForSecondMembershipSaveAttempt.TrySetResult();
                }

                await release.Task.WaitAsync(cancellationToken);
            }
        }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (eventData.Context is GymCrmDbContext context && IsMembershipMutationSaveAttempt(context))
            {
                await BlockForFirstTwoMembershipSavesAsync(cancellationToken);
            }

            return result;
        }
    }

    public sealed class MembershipAuditBlocker
    {
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task WaitAsync() => release.Task;

        public void Release() => release.TrySetResult();
    }

    private sealed class BlockingMembershipAuditLogService(
        GymCrmDbContext dbContext,
        MembershipAuditBlocker blocker) : IAuditLogService
    {
        public async Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default)
        {
            if (entry.EntityType == "ClientMembership")
            {
                await blocker.WaitAsync();
            }

            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = entry.UserId,
                ActionType = entry.ActionType,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                Description = entry.Description,
                Source = entry.Source,
                MessengerPlatform = entry.MessengerPlatform,
                MessengerPlatformUserIdHash = entry.MessengerPlatformUserIdHash,
                OldValueJson = entry.OldValueJson,
                NewValueJson = entry.NewValueJson,
                CreatedAt = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private sealed class ThrowingMembershipAuditLogService(GymCrmDbContext dbContext) : IAuditLogService
    {
        public async Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default)
        {
            if (entry.EntityType == "ClientMembership" || entry.ActionType == "ClientTransferred")
            {
                throw new InvalidOperationException("Mandatory membership audit failed for TASK-078 regression test.");
            }

            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = entry.UserId,
                ActionType = entry.ActionType,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                Description = entry.Description,
                Source = entry.Source,
                MessengerPlatform = entry.MessengerPlatform,
                MessengerPlatformUserIdHash = entry.MessengerPlatformUserIdHash,
                OldValueJson = entry.OldValueJson,
                NewValueJson = entry.NewValueJson,
                CreatedAt = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
