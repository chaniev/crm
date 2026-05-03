namespace GymCrm.Api.Auth;

internal sealed record CurrentMembershipSummaryResponse(
    Guid Id,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    bool IsPaid,
    bool SingleVisitUsed);
