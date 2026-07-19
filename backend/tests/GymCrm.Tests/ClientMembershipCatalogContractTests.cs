using GymCrm.Application.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class ClientMembershipCatalogContractTests
{
    [Fact]
    public void Purchase_command_exposes_catalog_validity_and_payment_snapshot_inputs_only()
    {
        var properties = typeof(CreateClientMembershipPurchaseCommand).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.Contains("ValidFrom", properties);
        Assert.Contains("ValidTo", properties);
        Assert.Contains("PaymentDate", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("PurchaseDate", properties);
    }

    [Fact]
    public void Renewal_command_does_not_accept_caller_controlled_dates_price_or_behavior()
    {
        var properties = typeof(RenewClientMembershipCommand).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.DoesNotContain("PaymentAmount", properties);
        Assert.DoesNotContain("RenewalDate", properties);
        Assert.DoesNotContain("ValidFrom", properties);
        Assert.DoesNotContain("ValidTo", properties);
    }

    [Fact]
    public void Snapshot_contract_uses_catalog_identity_and_explicit_behavior()
    {
        var properties = typeof(ClientMembershipSnapshotResult).GetProperties()
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("MembershipCatalogItemId", properties);
        Assert.Contains("MembershipName", properties);
        Assert.Contains("BehaviorKind", properties);
        Assert.Contains("IndividualValidFrom", properties);
        Assert.Contains("IndividualValidTo", properties);
        Assert.DoesNotContain("MembershipType", properties);
        Assert.Equal(typeof(MembershipBehaviorKind), typeof(ClientMembershipSnapshotResult).GetProperty("BehaviorKind")!.PropertyType);
    }
}
