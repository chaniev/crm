using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class ClientMembershipSalePricingPolicyTests
{
    [Fact]
    public void Catalog_uses_catalog_price_and_behavior()
    {
        var item = CreateCatalogItem(1500m);

        var result = ClientMembershipSalePricingPolicy.Resolve(item, null);

        AssertResolution(result, ClientMembershipSalePricingMode.Catalog, 1500m,
            MembershipBehaviorKind.Term, item.Id);
    }

    [Theory]
    [InlineData(1750)]
    [InlineData(1500)]
    public void Catalog_with_manual_amount_preserves_override_provenance(decimal manualAmount)
    {
        var item = CreateCatalogItem(1500m);

        var result = ClientMembershipSalePricingPolicy.Resolve(item, manualAmount);

        AssertResolution(result, ClientMembershipSalePricingMode.CatalogOverride, manualAmount,
            MembershipBehaviorKind.Term, item.Id);
    }

    [Fact]
    public void Manual_amount_without_catalog_creates_amount_only_term_resolution()
    {
        var result = ClientMembershipSalePricingPolicy.Resolve(null, 1900m);

        AssertResolution(result, ClientMembershipSalePricingMode.AmountOnly, 1900m,
            MembershipBehaviorKind.Term, null);
    }

    [Fact]
    public void Missing_catalog_and_amount_is_rejected()
    {
        var result = ClientMembershipSalePricingPolicy.Resolve(null, null);

        Assert.False(result.Succeeded);
        Assert.Equal(ClientMembershipSalePricingError.MissingCatalogAndAmount, result.Error);
        Assert.Null(result.Resolution);
    }

    [Fact]
    public void Professional_catalog_allows_only_zero_catalog_pricing()
    {
        var item = MembershipCatalogItem.CreateProfessional(
            "Профессиональный", new DateOnly(2026, 1, 1), null, DateTimeOffset.UtcNow);

        AssertResolution(
            ClientMembershipSalePricingPolicy.Resolve(item, null),
            ClientMembershipSalePricingMode.Catalog,
            0m,
            MembershipBehaviorKind.Professional,
            item.Id);

        var overrideResult = ClientMembershipSalePricingPolicy.Resolve(item, 1m);
        Assert.False(overrideResult.Succeeded);
        Assert.Equal(ClientMembershipSalePricingError.ProfessionalOverrideNotAllowed, overrideResult.Error);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(100.01)]
    [InlineData(100.50)]
    [InlineData(100000000)]
    public void Invalid_manual_amount_is_rejected(decimal amount)
    {
        var result = ClientMembershipSalePricingPolicy.Resolve(null, amount);

        Assert.False(result.Succeeded);
        Assert.Equal(ClientMembershipSalePricingError.InvalidManualAmount, result.Error);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(99999999)]
    public void Positive_integral_rubles_within_numeric_range_are_valid(decimal amount)
    {
        Assert.True(ClientMembershipSalePricingPolicy.IsWholeRubAmount(amount, allowZero: false));
    }

    [Fact]
    public void Zero_is_valid_only_when_explicitly_allowed()
    {
        Assert.True(ClientMembershipSalePricingPolicy.IsWholeRubAmount(0m, allowZero: true));
        Assert.False(ClientMembershipSalePricingPolicy.IsWholeRubAmount(0m, allowZero: false));
    }

    [Fact]
    public void Fractional_catalog_price_is_rejected_by_resolver()
    {
        var item = CreateCatalogItem(1500m);
        item.Price = 1500.50m;

        var result = ClientMembershipSalePricingPolicy.Resolve(item, null);

        Assert.False(result.Succeeded);
        Assert.Equal(ClientMembershipSalePricingError.InvalidCatalogPrice, result.Error);
    }

    private static MembershipCatalogItem CreateCatalogItem(decimal price) =>
        MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Срочный", price, MembershipBehaviorKind.Term,
            new DateOnly(2026, 1, 1), null, DateTimeOffset.UtcNow);

    private static void AssertResolution(
        ClientMembershipSalePricingResult result,
        ClientMembershipSalePricingMode expectedMode,
        decimal expectedAmount,
        MembershipBehaviorKind expectedBehavior,
        Guid? expectedCatalogItemId)
    {
        Assert.True(result.Succeeded);
        var resolution = Assert.IsType<ClientMembershipSalePricingResolution>(result.Resolution);
        Assert.Equal(expectedMode, resolution.PricingMode);
        Assert.Equal(expectedAmount, resolution.GrossAmount);
        Assert.Equal(expectedBehavior, resolution.BehaviorKind);
        Assert.Equal(expectedCatalogItemId, resolution.MembershipCatalogItemId);
    }
}
