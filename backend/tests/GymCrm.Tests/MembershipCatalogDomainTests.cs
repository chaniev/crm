using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class MembershipCatalogDomainTests
{
    [Theory]
    [InlineData("  МЕСЯЧНЫЙ\t  абонемент ", "МЕСЯЧНЫЙ АБОНЕМЕНТ")]
    [InlineData("  Ёлочка\nПлюс ", "ЕЛОЧКА ПЛЮС")]
    public void NormalizeName_CollapsesWhitespace_AndTreatsYoAsYe(string value, string expected)
    {
        Assert.Equal(expected, MembershipCatalogItem.NormalizeName(value));
    }

    [Fact]
    public void IsAvailableOn_UsesInclusiveBounds_AndSupportsOpenEnd()
    {
        var item = MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Абонемент", 1000m, MembershipBehaviorKind.Term,
            new DateOnly(2026, 7, 1), null, DateTimeOffset.UtcNow);

        Assert.False(item.IsAvailableOn(new DateOnly(2026, 6, 30)));
        Assert.True(item.IsAvailableOn(new DateOnly(2026, 7, 1)));
        Assert.True(item.IsAvailableOn(new DateOnly(2030, 1, 1)));
    }

    [Fact]
    public void Create_RejectsReversedRangeAndInvalidPrices()
    {
        Assert.Throws<ArgumentException>(() => MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Абонемент", 0m, MembershipBehaviorKind.Term,
            new DateOnly(2026, 7, 2), new DateOnly(2026, 7, 1), DateTimeOffset.UtcNow));

        Assert.Throws<ArgumentException>(() => MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Абонемент", 0m, MembershipBehaviorKind.SingleVisit,
            new DateOnly(2026, 7, 1), null, DateTimeOffset.UtcNow));

        Assert.Throws<ArgumentException>(() => MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Абонемент", 100.50m, MembershipBehaviorKind.Term,
            new DateOnly(2026, 7, 1), null, DateTimeOffset.UtcNow));

        Assert.Throws<ArgumentException>(() => MembershipCatalogItem.CreateBranchOwned(
            Guid.NewGuid(), "Абонемент", 100_000_000m, MembershipBehaviorKind.Term,
            new DateOnly(2026, 7, 1), null, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void Professional_IsGlobalAndMayHaveZeroPrice()
    {
        var item = MembershipCatalogItem.CreateProfessional(
            "Профессиональный", new DateOnly(2026, 1, 1), null, DateTimeOffset.UtcNow);

        Assert.Null(item.BranchId);
        Assert.Equal(0m, item.Price);
        Assert.Equal(MembershipBehaviorKind.Professional, item.BehaviorKind);
        Assert.True(item.IsSystemOwned);
    }
}
