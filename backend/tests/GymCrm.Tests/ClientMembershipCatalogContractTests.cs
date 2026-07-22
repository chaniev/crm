using GymCrm.Application.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class ClientMembershipCatalogContractTests
{
    [Fact]
    public void Purchase_command_exposes_nullable_catalog_manual_amount_validity_and_payment_inputs_only()
    {
        var properties = typeof(CreateClientMembershipPurchaseCommand).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.Contains("ManualSaleAmount", properties);
        Assert.Contains("ValidFrom", properties);
        Assert.Contains("ValidTo", properties);
        Assert.Contains("PaymentDate", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("GrossAmount", properties);
        Assert.DoesNotContain("PricingMode", properties);
        Assert.DoesNotContain("BehaviorKind", properties);
        Assert.DoesNotContain("PurchaseDate", properties);
        Assert.Equal(typeof(Guid?), typeof(CreateClientMembershipPurchaseCommand)
            .GetProperty("MembershipCatalogItemId")!.PropertyType);
    }

    [Fact]
    public void Renewal_command_does_not_accept_caller_controlled_dates_price_or_behavior()
    {
        var properties = typeof(RenewClientMembershipCommand).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.Contains("ManualSaleAmount", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("GrossAmount", properties);
        Assert.DoesNotContain("PricingMode", properties);
        Assert.DoesNotContain("BehaviorKind", properties);
        Assert.DoesNotContain("RenewalDate", properties);
        Assert.DoesNotContain("ValidFrom", properties);
        Assert.DoesNotContain("ValidTo", properties);
    }

    [Fact]
    public void Snapshot_contract_uses_canonical_sale_pricing_and_nullable_catalog_identity()
    {
        var properties = typeof(ClientMembershipSnapshotResult).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.Contains("MembershipName", properties);
        Assert.Contains("BehaviorKind", properties);
        Assert.Contains("IndividualValidFrom", properties);
        Assert.Contains("IndividualValidTo", properties);
        Assert.Contains("PricingMode", properties);
        Assert.Contains("GrossAmount", properties);
        Assert.Contains("CatalogPrice", properties);
        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.Equal(typeof(MembershipBehaviorKind), typeof(ClientMembershipSnapshotResult).GetProperty("BehaviorKind")!.PropertyType);
        Assert.Equal(typeof(Guid?), typeof(ClientMembershipSnapshotResult).GetProperty("MembershipCatalogItemId")!.PropertyType);
    }

    [Fact]
    public void Membership_version_does_not_duplicate_sale_amount_or_catalog_identity()
    {
        var properties = typeof(GymCrm.Domain.Clients.ClientMembership).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("MembershipCatalogItemId", properties);
        Assert.DoesNotContain("MembershipCatalogItem", properties);
    }
}
