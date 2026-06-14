namespace GymCrm.Api.Auth;

internal sealed record MembershipAttentionListItemResponse(
    Guid ClientId,
    string FullName,
    string MembershipType,
    DateOnly? ExpirationDate,
    int? DaysUntilExpiration,
    bool IsPaid,
    string State);
