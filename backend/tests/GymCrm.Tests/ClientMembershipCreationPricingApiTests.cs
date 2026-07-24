using System.Net;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class ClientMembershipCreationPricingApiTests
{
    [Fact]
    public async Task Purchase_requires_payment_date_and_rejects_legacy_unpaid_without_writes()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var missingPaymentDate = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": null,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertRejectedWithoutWritesAsync(context, missingPaymentDate, "paymentDate");

        using var legacyUnpaid = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": null,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentStatus": "Unpaid",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertProblemWithoutWritesAsync(
            context,
            legacyUnpaid,
            HttpStatusCode.BadRequest,
            "membership-payment-status-removed",
            "paymentStatus");
    }

    [Fact]
    public async Task Purchase_with_backdated_payment_projects_sale_owned_payment_metadata_without_is_paid()
    {
        await using var context = await PricingApiContext.CreateAsync();
        var paymentDate = context.Today.AddDays(-45);

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": null,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{paymentDate:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var currentMembership = GetRequiredProperty(document.RootElement, "currentMembership");

        Assert.Equal(paymentDate.ToString("yyyy-MM-dd"), GetRequiredProperty(currentMembership, "paymentDate").GetString());
        Assert.Equal(context.ActorId, GetRequiredProperty(currentMembership, "paymentRecordedByUserId").GetGuid());
        Assert.Equal("Pricing API Head Coach", GetRequiredProperty(currentMembership, "paymentRecordedByUserName").GetString());
        Assert.Equal(JsonValueKind.String, GetRequiredProperty(currentMembership, "paymentRecordedAt").ValueKind);
        Assert.False(currentMembership.TryGetProperty("isPaid", out _));
        Assert.False(currentMembership.TryGetProperty("paidByUserId", out _));
        Assert.False(currentMembership.TryGetProperty("paidAt", out _));
    }

    [Fact]
    public async Task Mark_payment_endpoint_is_authorized_tombstone_without_writes()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.MarkPaymentAsync(
            """
            {
              "saleId": "11111111-1111-1111-1111-111111111111",
              "expectedMembershipId": "22222222-2222-2222-2222-222222222222"
            }
            """);

        await AssertProblemWithoutWritesAsync(
            context,
            response,
            HttpStatusCode.Gone,
            "membership-payment-action-removed",
            "membership");
    }

    [Fact]
    public async Task Purchase_with_catalog_uses_catalog_amount_and_persists_catalog_provenance()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertSuccessfulPurchaseAsync(
            context,
            response,
            expectedCatalogItemId: context.TermCatalogItemId,
            expectedMembershipName: PricingApiContext.TermCatalogItemName,
            expectedPricingMode: "Catalog",
            expectedGrossAmount: PricingApiContext.TermCatalogPrice,
            expectedCatalogPrice: PricingApiContext.TermCatalogPrice,
            expectedBehaviorKind: "Term");
    }

    [Fact]
    public async Task Purchase_with_catalog_and_different_manual_amount_persists_override()
    {
        await using var context = await PricingApiContext.CreateAsync();
        const decimal manualAmount = 1750m;

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": {{manualAmount}},
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertSuccessfulPurchaseAsync(
            context,
            response,
            expectedCatalogItemId: context.TermCatalogItemId,
            expectedMembershipName: PricingApiContext.TermCatalogItemName,
            expectedPricingMode: "CatalogOverride",
            expectedGrossAmount: manualAmount,
            expectedCatalogPrice: PricingApiContext.TermCatalogPrice,
            expectedBehaviorKind: "Term");
    }

    [Fact]
    public async Task Purchase_with_catalog_and_equal_manual_amount_preserves_override_provenance()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": {{PricingApiContext.TermCatalogPrice}},
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertSuccessfulPurchaseAsync(
            context,
            response,
            expectedCatalogItemId: context.TermCatalogItemId,
            expectedMembershipName: PricingApiContext.TermCatalogItemName,
            expectedPricingMode: "CatalogOverride",
            expectedGrossAmount: PricingApiContext.TermCatalogPrice,
            expectedCatalogPrice: PricingApiContext.TermCatalogPrice,
            expectedBehaviorKind: "Term");
    }

    [Fact]
    public async Task Purchase_with_manual_amount_only_creates_term_membership_without_catalog()
    {
        await using var context = await PricingApiContext.CreateAsync();
        const decimal manualAmount = 1900m;

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": null,
              "manualSaleAmount": {{manualAmount}},
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertSuccessfulPurchaseAsync(
            context,
            response,
            expectedCatalogItemId: null,
            expectedMembershipName: "Без варианта каталога",
            expectedPricingMode: "AmountOnly",
            expectedGrossAmount: manualAmount,
            expectedCatalogPrice: null,
            expectedBehaviorKind: "Term");

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var sale = await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
            .ClientMembershipSales.AsNoTracking()
            .SingleAsync(candidate => candidate.ClientId == context.ClientId);
        Assert.Equal(ClientMembershipSalePricingMode.AmountOnly, sale.PricingMode);
        Assert.Null(sale.MembershipCatalogItemId);
    }

    [Fact]
    public async Task Purchase_with_professional_catalog_keeps_zero_catalog_price()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.ProfessionalCatalogItemId}}",
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": null,
              "paymentStatus": "Paid",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": "Подтверждено главным тренером"
            }
            """);

        await AssertSuccessfulPurchaseAsync(
            context,
            response,
            expectedCatalogItemId: context.ProfessionalCatalogItemId,
            expectedMembershipName: PricingApiContext.ProfessionalCatalogItemName,
            expectedPricingMode: "Catalog",
            expectedGrossAmount: 0m,
            expectedCatalogPrice: 0m,
            expectedBehaviorKind: "Professional");
    }

    [Fact]
    public async Task Purchase_with_fractional_manual_amount_returns_validation_problem_without_writes()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "manualSaleAmount": 1750.50,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertRejectedWithoutWritesAsync(context, response, "manualSaleAmount");
    }

    [Fact]
    public async Task Purchase_without_catalog_or_manual_amount_returns_both_field_errors_without_writes()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": null,
              "manualSaleAmount": null,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertRejectedWithoutWritesAsync(
            context,
            response,
            "membershipCatalogItemId",
            "manualSaleAmount");
    }

    [Fact]
    public async Task Purchase_rejects_forbidden_backend_owned_field_even_when_explicitly_null()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using var response = await context.PurchaseAsync(
            $$"""
            {
              "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
              "pricingMode": null,
              "validFrom": "{{context.Today:yyyy-MM-dd}}",
              "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);

        await AssertRejectedWithoutWritesAsync(context, response, "pricingMode");
    }

    [Fact]
    public async Task Renew_from_catalog_override_to_amount_only_preserves_prior_sale_and_exact_duration()
    {
        await using var context = await PricingApiContext.CreateAsync();

        using (var purchaseResponse = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "manualSaleAmount": 1750,
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(9):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """))
        {
            Assert.Equal(HttpStatusCode.OK, purchaseResponse.StatusCode);
        }

        using var renewResponse = await context.RenewAsync(
            $$"""
            {
              "membershipCatalogItemId": null,
              "manualSaleAmount": 1900,
              "paymentDate": "{{context.Today:yyyy-MM-dd}}",
              "professionalComment": null
            }
            """);
        Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var sales = await dbContext.ClientMembershipSales
            .AsNoTracking()
            .Where(sale => sale.ClientId == context.ClientId)
            .OrderBy(sale => sale.CreatedAt)
            .ToArrayAsync();
        Assert.Equal(2, sales.Length);
        Assert.Equal(ClientMembershipSalePricingMode.CatalogOverride, sales[0].PricingMode);
        Assert.Equal(1750m, sales[0].GrossAmount);
        Assert.Equal(context.TermCatalogItemId, sales[0].MembershipCatalogItemId);
        Assert.Equal(ClientMembershipSalePricingMode.AmountOnly, sales[1].PricingMode);
        Assert.Equal(1900m, sales[1].GrossAmount);
        Assert.Null(sales[1].MembershipCatalogItemId);

        var memberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership => membership.ClientId == context.ClientId)
            .OrderBy(membership => membership.IndividualValidFrom)
            .ToArrayAsync();
        Assert.Equal(2, memberships.Length);
        Assert.Equal(context.Today, memberships[0].IndividualValidFrom);
        Assert.Equal(context.Today.AddDays(9), memberships[0].IndividualValidTo);
        Assert.Equal(context.Today.AddDays(10), memberships[1].IndividualValidFrom);
        Assert.Equal(context.Today.AddDays(19), memberships[1].IndividualValidTo);
        Assert.All(memberships, membership => Assert.Equal(MembershipBehaviorKind.Term, membership.BehaviorKind));
    }

    [Fact]
    public async Task Correction_and_mark_payment_reject_even_null_extra_fields_and_keep_sale_pricing_immutable()
    {
        await using var context = await PricingApiContext.CreateAsync();
        using (var purchaseResponse = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": "{{context.TermCatalogItemId}}",
                     "manualSaleAmount": 1750,
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """))
        {
            Assert.Equal(HttpStatusCode.OK, purchaseResponse.StatusCode);
        }

        using (var correctionResponse = await context.CorrectAsync(
                   $$"""
                   {
                     "purchaseDate": "{{context.Today:yyyy-MM-dd}}",
                     "expirationDate": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "grossAmount": null
                   }
                   """))
        {
            await AssertValidationFieldAsync(correctionResponse, "grossAmount");
        }

        using (var invalidMarkResponse = await context.MarkPaymentAsync("""{"paymentAmount":null}"""))
        {
            await AssertProblemAsync(
                invalidMarkResponse,
                HttpStatusCode.Gone,
                "membership-payment-action-removed",
                "membership");
        }

        Guid targetSaleId;
        Guid targetMembershipId;
        await using (var targetScope = context.Factory.Services.CreateAsyncScope())
        {
            var target = await targetScope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
                .ClientMemberships.AsNoTracking()
                .Where(membership => membership.ClientId == context.ClientId && membership.ValidTo == null)
                .Select(membership => new { membership.SaleId, membership.Id })
                .SingleAsync();
            targetSaleId = target.SaleId;
            targetMembershipId = target.Id;
        }

        using (var validMarkResponse = await context.MarkPaymentAsync(
                   $$"""{"saleId":"{{targetSaleId}}","expectedMembershipId":"{{targetMembershipId}}"}"""))
        {
            await AssertProblemAsync(
                validMarkResponse,
                HttpStatusCode.Gone,
                "membership-payment-action-removed",
                "membership");
        }

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var sale = await dbContext.ClientMembershipSales.AsNoTracking()
            .SingleAsync(candidate => candidate.ClientId == context.ClientId);
        Assert.Equal(ClientMembershipSalePricingMode.CatalogOverride, sale.PricingMode);
        Assert.Equal(1750m, sale.GrossAmount);
        Assert.Equal(context.TermCatalogItemId, sale.MembershipCatalogItemId);
        Assert.Equal(1, await dbContext.ClientMemberships.CountAsync(candidate => candidate.ClientId == context.ClientId));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Refund_integer_ceiling_fraction_and_cancel_use_canonical_override_or_amount_only_gross(bool amountOnly)
    {
        await using var context = await PricingApiContext.CreateAsync();
        var catalogJson = amountOnly ? "null" : $"\"{context.TermCatalogItemId}\"";
        using (var purchaseResponse = await context.PurchaseAsync(
                   $$"""
                   {
                     "membershipCatalogItemId": {{catalogJson}},
                     "manualSaleAmount": 1750,
                     "validFrom": "{{context.Today:yyyy-MM-dd}}",
                     "validTo": "{{context.Today.AddDays(29):yyyy-MM-dd}}",
                     "paymentStatus": "Paid",
                     "paymentDate": "{{context.Today:yyyy-MM-dd}}",
                     "professionalComment": null
                   }
                   """))
        {
            Assert.Equal(HttpStatusCode.OK, purchaseResponse.StatusCode);
        }

        Guid saleId;
        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            saleId = await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
                .ClientMembershipSales.Where(sale => sale.ClientId == context.ClientId)
                .Select(sale => sale.Id).SingleAsync();
        }

        using (var fractional = await context.RefundAsync(saleId,
                   $$"""{"amount":10.50,"refundDate":"{{context.Today:yyyy-MM-dd}}"}"""))
        {
            await AssertValidationFieldAsync(fractional, "amount");
        }
        using (var valid = await context.RefundAsync(saleId,
                   $$"""{"amount":1700,"refundDate":"{{context.Today:yyyy-MM-dd}}"}"""))
        {
            Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
        }
        using (var overCeiling = await context.RefundAsync(saleId,
                   $$"""{"amount":51,"refundDate":"{{context.Today:yyyy-MM-dd}}"}"""))
        {
            Assert.Equal(HttpStatusCode.BadRequest, overCeiling.StatusCode);
        }

        Guid refundId;
        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            refundId = await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
                .ClientMembershipRefunds.Where(refund => refund.SaleId == saleId)
                .Select(refund => refund.Id).SingleAsync();
        }
        using var cancel = await context.CancelRefundAsync(refundId);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        await using var verificationScope = context.Factory.Services.CreateAsyncScope();
        var persisted = await verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
            .ClientMembershipRefunds.AsNoTracking().SingleAsync(refund => refund.Id == refundId);
        Assert.NotNull(persisted.CanceledAt);
    }

    private static async Task AssertValidationFieldAsync(HttpResponseMessage response, string expectedField)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var document = JsonDocument.Parse(body);
        var errors = GetRequiredProperty(document.RootElement, "errors");
        Assert.True(errors.TryGetProperty(expectedField, out _), body);
    }

    private static async Task AssertSuccessfulPurchaseAsync(
        PricingApiContext context,
        HttpResponseMessage response,
        Guid? expectedCatalogItemId,
        string expectedMembershipName,
        string expectedPricingMode,
        decimal expectedGrossAmount,
        decimal? expectedCatalogPrice,
        string expectedBehaviorKind)
    {
        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
            $"Expected successful purchase, got {(int)response.StatusCode} {response.StatusCode}. Body: {responseBody}");

        using var responseDocument = JsonDocument.Parse(responseBody);
        var currentMembershipPayload = GetRequiredProperty(responseDocument.RootElement, "currentMembership");
        Assert.Equal(JsonValueKind.Object, currentMembershipPayload.ValueKind);
        var membershipId = GetRequiredProperty(currentMembershipPayload, "id").GetGuid();
        var saleId = GetRequiredProperty(currentMembershipPayload, "saleId").GetGuid();

        await using var scope = context.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var sale = await dbContext.ClientMembershipSales
            .AsNoTracking()
            .SingleAsync(candidate => candidate.ClientId == context.ClientId);
        var membership = await dbContext.ClientMemberships
            .AsNoTracking()
            .SingleAsync(candidate => candidate.ClientId == context.ClientId && candidate.ValidTo == null);

        Assert.Equal(saleId, sale.Id);
        Assert.Equal(membershipId, membership.Id);
        Assert.Equal(sale.Id, membership.SaleId);
        Assert.Equal(expectedGrossAmount, sale.GrossAmount);
        Assert.Equal(expectedCatalogItemId, ReadNullableGuidProperty(sale, "MembershipCatalogItemId"));
        Assert.Equal(expectedBehaviorKind, sale.BehaviorKind.ToString());
        Assert.Equal(sale.BehaviorKind, membership.BehaviorKind);
        Assert.Equal(context.Today, membership.IndividualValidFrom);
        Assert.Equal(
            expectedBehaviorKind == "Professional" ? null : context.Today.AddDays(29),
            membership.IndividualValidTo);
        Assert.Equal(expectedPricingMode, ReadRequiredPropertyValue(sale, "PricingMode"));
        Assert.Null(membership.GetType().GetProperty("MembershipCatalogItemId"));
        Assert.Null(membership.GetType().GetProperty("PaymentAmount"));

        Assert.Equal(expectedCatalogItemId, ReadNullableGuidJson(currentMembershipPayload, "membershipCatalogItemId"));
        Assert.Equal(expectedMembershipName, GetRequiredProperty(currentMembershipPayload, "membershipName").GetString());
        Assert.Equal(expectedBehaviorKind, GetRequiredProperty(currentMembershipPayload, "behaviorKind").GetString());
        Assert.Equal(expectedPricingMode, GetRequiredProperty(currentMembershipPayload, "pricingMode").GetString());
        Assert.Equal(expectedGrossAmount, GetRequiredProperty(currentMembershipPayload, "grossAmount").GetDecimal());
        AssertNullableDecimal(expectedCatalogPrice, GetRequiredProperty(currentMembershipPayload, "catalogPrice"));

        var audit = await dbContext.AuditLogs
            .AsNoTracking()
            .SingleAsync(log =>
                log.UserId == context.ActorId &&
                log.ActionType == "ClientMembershipPurchased" &&
                log.EntityId == membership.Id.ToString());
        Assert.Null(audit.OldValueJson);
        Assert.False(string.IsNullOrWhiteSpace(audit.NewValueJson));

        using var auditDocument = JsonDocument.Parse(audit.NewValueJson!);
        var auditPayload = auditDocument.RootElement;
        Assert.Equal(sale.Id, GetRequiredProperty(auditPayload, "saleId").GetGuid());
        Assert.Equal(expectedCatalogItemId, ReadNullableGuidJson(auditPayload, "membershipCatalogItemId"));
        Assert.Equal(expectedMembershipName, GetRequiredProperty(auditPayload, "membershipName").GetString());
        Assert.Equal(expectedBehaviorKind, GetRequiredProperty(auditPayload, "behaviorKind").GetString());
        Assert.Equal(expectedPricingMode, GetRequiredProperty(auditPayload, "pricingMode").GetString());
        Assert.Equal(expectedGrossAmount, GetRequiredProperty(auditPayload, "grossAmount").GetDecimal());
        AssertNullableDecimal(expectedCatalogPrice, GetRequiredProperty(auditPayload, "catalogPrice"));
    }

    private static async Task AssertRejectedWithoutWritesAsync(
        PricingApiContext context,
        HttpResponseMessage response,
        params string[] expectedErrorFields)
    {
        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Empty(await dbContext.ClientMembershipSales
                .AsNoTracking()
                .Where(sale => sale.ClientId == context.ClientId)
                .ToArrayAsync());
            Assert.Empty(await dbContext.ClientMemberships
                .AsNoTracking()
                .Where(membership => membership.ClientId == context.ClientId)
                .ToArrayAsync());
            Assert.Empty(await dbContext.AuditLogs
                .AsNoTracking()
                .Where(log => log.ActionType == "ClientMembershipPurchased")
                .ToArrayAsync());
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var responseDocument = JsonDocument.Parse(responseBody);
        var errors = GetRequiredProperty(responseDocument.RootElement, "errors");
        Assert.Equal(JsonValueKind.Object, errors.ValueKind);
        foreach (var expectedField in expectedErrorFields)
        {
            Assert.True(
                errors.TryGetProperty(expectedField, out var messages),
                $"Expected validation error for '{expectedField}'. Body: {responseBody}");
            Assert.Equal(JsonValueKind.Array, messages.ValueKind);
            Assert.NotEmpty(messages.EnumerateArray());
        }
    }

    private static async Task AssertProblemWithoutWritesAsync(
        PricingApiContext context,
        HttpResponseMessage response,
        HttpStatusCode expectedStatusCode,
        string expectedType,
        params string[] expectedErrorFields)
    {
        await using (var scope = context.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Empty(await dbContext.ClientMembershipSales
                .AsNoTracking()
                .Where(sale => sale.ClientId == context.ClientId)
                .ToArrayAsync());
            Assert.Empty(await dbContext.ClientMemberships
                .AsNoTracking()
                .Where(membership => membership.ClientId == context.ClientId)
                .ToArrayAsync());
            Assert.Empty(await dbContext.AuditLogs
                .AsNoTracking()
                .Where(log => log.EntityId == context.ClientId.ToString() || log.ActionType.Contains("Membership"))
                .ToArrayAsync());
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.Equal(expectedStatusCode, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var responseDocument = JsonDocument.Parse(responseBody);
        Assert.Equal(expectedType, GetRequiredProperty(responseDocument.RootElement, "type").GetString());
        var errors = GetRequiredProperty(responseDocument.RootElement, "errors");
        Assert.Equal(JsonValueKind.Object, errors.ValueKind);
        foreach (var expectedField in expectedErrorFields)
        {
            Assert.True(
                errors.TryGetProperty(expectedField, out var messages),
                $"Expected validation error for '{expectedField}'. Body: {responseBody}");
            Assert.Equal(JsonValueKind.Array, messages.ValueKind);
            Assert.NotEmpty(messages.EnumerateArray());
        }
    }

    private static async Task AssertProblemAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatusCode,
        string expectedType,
        params string[] expectedErrorFields)
    {
        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.Equal(expectedStatusCode, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var responseDocument = JsonDocument.Parse(responseBody);
        Assert.Equal(expectedType, GetRequiredProperty(responseDocument.RootElement, "type").GetString());
        var errors = GetRequiredProperty(responseDocument.RootElement, "errors");
        Assert.Equal(JsonValueKind.Object, errors.ValueKind);
        foreach (var expectedField in expectedErrorFields)
        {
            Assert.True(
                errors.TryGetProperty(expectedField, out var messages),
                $"Expected validation field '{expectedField}' in {responseBody}");
            Assert.Equal(JsonValueKind.Array, messages.ValueKind);
            Assert.NotEmpty(messages.EnumerateArray());
        }
    }

    private static JsonElement GetRequiredProperty(JsonElement element, string propertyName)
    {
        Assert.True(
            element.TryGetProperty(propertyName, out var value),
            $"Expected JSON property '{propertyName}' in {element.GetRawText()}.");
        return value;
    }

    private static Guid? ReadNullableGuidJson(JsonElement element, string propertyName)
    {
        var value = GetRequiredProperty(element, propertyName);
        return value.ValueKind == JsonValueKind.Null ? null : value.GetGuid();
    }

    private static Guid? ReadNullableGuidProperty(object target, string propertyName)
    {
        var property = target.GetType().GetProperty(propertyName);
        Assert.True(
            property is not null,
            $"Expected persisted {target.GetType().Name} to expose '{propertyName}'.");
        var value = property!.GetValue(target);
        return value switch
        {
            null => null,
            Guid guid => guid,
            _ => throw new Xunit.Sdk.XunitException(
                $"Expected '{target.GetType().Name}.{propertyName}' to contain a Guid or null, got {value.GetType().Name}.")
        };
    }

    private static string ReadRequiredPropertyValue(object target, string propertyName)
    {
        var property = target.GetType().GetProperty(propertyName);
        Assert.True(
            property is not null,
            $"Expected persisted {target.GetType().Name} to expose '{propertyName}'.");
        var value = property!.GetValue(target);
        Assert.NotNull(value);
        return value!.ToString()!;
    }

    private static void AssertNullableDecimal(decimal? expected, JsonElement actual)
    {
        if (expected.HasValue)
        {
            Assert.Equal(expected.Value, actual.GetDecimal());
            return;
        }

        Assert.Equal(JsonValueKind.Null, actual.ValueKind);
    }

    private sealed class PricingApiContext : IAsyncDisposable
    {
        public const string TermCatalogItemName = "Срочный 30 дней";
        public const string ProfessionalCatalogItemName = "Профессиональный";
        public const decimal TermCatalogPrice = 1500m;

        private PricingApiContext(
            PricingApiAppFactory factory,
            HttpClient httpClient,
            Guid actorId,
            Guid clientId,
            Guid termCatalogItemId,
            Guid professionalCatalogItemId,
            DateOnly today,
            string csrfToken)
        {
            Factory = factory;
            HttpClient = httpClient;
            ActorId = actorId;
            ClientId = clientId;
            TermCatalogItemId = termCatalogItemId;
            ProfessionalCatalogItemId = professionalCatalogItemId;
            Today = today;
            CsrfToken = csrfToken;
        }

        public PricingApiAppFactory Factory { get; }
        public HttpClient HttpClient { get; }
        public Guid ActorId { get; }
        public Guid ClientId { get; }
        public Guid TermCatalogItemId { get; }
        public Guid ProfessionalCatalogItemId { get; }
        public DateOnly Today { get; }
        private string CsrfToken { get; }

        public static async Task<PricingApiContext> CreateAsync()
        {
            var factory = new PricingApiAppFactory();
            var httpClient = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });

            try
            {
                var seeded = await SeedAsync(factory);
                var csrfToken = await LoginAsync(httpClient, seeded.Login, seeded.Password);
                return new PricingApiContext(
                    factory,
                    httpClient,
                    seeded.ActorId,
                    seeded.ClientId,
                    seeded.TermCatalogItemId,
                    seeded.ProfessionalCatalogItemId,
                    seeded.Today,
                    csrfToken);
            }
            catch
            {
                httpClient.Dispose();
                await factory.DisposeAsync();
                throw;
            }
        }

        public Task<HttpResponseMessage> PurchaseAsync(string rawJson) =>
            SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                $"/clients/{ClientId}/membership/purchase",
                rawJson,
                CsrfToken);

        public Task<HttpResponseMessage> AttentionAsync() => HttpClient.GetAsync("/clients/attention");

        public Task<HttpResponseMessage> RenewAsync(string rawJson) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/renew", rawJson, CsrfToken);

        public Task<HttpResponseMessage> CorrectAsync(string rawJson) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/correct", rawJson, CsrfToken);

        public Task<HttpResponseMessage> MarkPaymentAsync(string rawJson) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/mark-payment", rawJson, CsrfToken);

        public Task<HttpResponseMessage> RefundAsync(Guid saleId, string rawJson) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/sales/{saleId}/refunds", rawJson, CsrfToken);

        public Task<HttpResponseMessage> CancelRefundAsync(Guid refundId) =>
            SendRawJsonAsync(HttpClient, HttpMethod.Post, $"/clients/{ClientId}/membership/refunds/{refundId}/cancel", "{}", CsrfToken);

        public async ValueTask DisposeAsync()
        {
            HttpClient.Dispose();
            await Factory.DisposeAsync();
        }

        private static async Task<SeededData> SeedAsync(PricingApiAppFactory factory)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var businessDateProvider = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>();

            var now = DateTimeOffset.UtcNow;
            var today = businessDateProvider.Today;
            var password = "pricing-red-phase-password";
            var branch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Pricing API branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var actor = new User
            {
                Id = Guid.NewGuid(),
                FullName = "Pricing API Head Coach",
                Login = $"pricing-head-coach-{Guid.NewGuid():N}",
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
                LastName = "Прайсинг",
                FirstName = "Клиент",
                Phone = $"+79{Random.Shared.NextInt64(100_000_000, 999_999_999)}",
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };
            var termCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                branch.Id,
                TermCatalogItemName,
                TermCatalogPrice,
                MembershipBehaviorKind.Term,
                today.AddYears(-1),
                null,
                now);
            var professionalCatalogItem = MembershipCatalogItem.CreateProfessional(
                ProfessionalCatalogItemName,
                today.AddYears(-1),
                null,
                now);

            dbContext.Branches.Add(branch);
            dbContext.Users.Add(actor);
            dbContext.Clients.Add(client);
            dbContext.MembershipCatalogItems.AddRange(termCatalogItem, professionalCatalogItem);
            await dbContext.SaveChangesAsync();

            return new SeededData(
                actor.Id,
                actor.Login,
                password,
                client.Id,
                termCatalogItem.Id,
                professionalCatalogItem.Id,
                today);
        }

        private static async Task<string> LoginAsync(HttpClient httpClient, string login, string password)
        {
            using var initialSessionResponse = await httpClient.GetAsync("/auth/session");
            Assert.Equal(HttpStatusCode.OK, initialSessionResponse.StatusCode);
            using var initialSessionDocument = JsonDocument.Parse(
                await initialSessionResponse.Content.ReadAsStringAsync());
            var csrfToken = GetRequiredProperty(initialSessionDocument.RootElement, "csrfToken").GetString();
            Assert.False(string.IsNullOrWhiteSpace(csrfToken));

            using var loginResponse = await SendRawJsonAsync(
                httpClient,
                HttpMethod.Post,
                "/auth/login",
                $$"""{"login":"{{login}}","password":"{{password}}"}""",
                csrfToken!);
            var loginBody = await loginResponse.Content.ReadAsStringAsync();
            Assert.True(
                loginResponse.StatusCode == HttpStatusCode.OK,
                $"Expected login success, got {(int)loginResponse.StatusCode} {loginResponse.StatusCode}. Body: {loginBody}");

            using var loginDocument = JsonDocument.Parse(loginBody);
            return GetRequiredProperty(loginDocument.RootElement, "csrfToken").GetString()
                ?? throw new Xunit.Sdk.XunitException("Authenticated session did not return a CSRF token.");
        }

        private sealed record SeededData(
            Guid ActorId,
            string Login,
            string Password,
            Guid ClientId,
            Guid TermCatalogItemId,
            Guid ProfessionalCatalogItemId,
            DateOnly Today);
    }

    private static async Task<HttpResponseMessage> SendRawJsonAsync(
        HttpClient httpClient,
        HttpMethod method,
        string path,
        string rawJson,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(method, path)
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        if (path.Contains("/membership/purchase", StringComparison.Ordinal) ||
            path.Contains("/membership/renew", StringComparison.Ordinal) ||
            path.Contains("/membership/correct", StringComparison.Ordinal) ||
            path.Contains("/membership/mark-payment", StringComparison.Ordinal))
        {
            request.Headers.Add("Idempotency-Key", $"pricing-test-{Guid.NewGuid():N}");
        }
        return await httpClient.SendAsync(request);
    }

    public sealed class PricingApiAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] =
                        "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "pricing-api-bootstrap",
                    ["BootstrapUser:FullName"] = "Pricing API Bootstrap",
                    ["ClientPhoto:StorageRootPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-pricing-api-tests-{Guid.NewGuid():N}")
                }));

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

                var databaseName = $"gym-crm-pricing-api-tests-{Guid.NewGuid():N}";
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
