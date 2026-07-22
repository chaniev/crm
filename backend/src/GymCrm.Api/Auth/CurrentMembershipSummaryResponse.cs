namespace GymCrm.Api.Auth;

internal sealed record CurrentMembershipSummaryResponse(
    Guid Id,
    Guid? MembershipCatalogItemId,
    string MembershipName,
    string BehaviorKind,
    string PricingMode,
    decimal GrossAmount,
    decimal? CatalogPrice,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    bool IsPaid,
    bool SingleVisitUsed);
