namespace GymCrm.Api.Auth;

internal sealed record CurrentMembershipSummaryResponse(
    Guid Id,
    Guid MembershipCatalogItemId,
    string MembershipName,
    string BehaviorKind,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    bool IsPaid,
    bool SingleVisitUsed);
