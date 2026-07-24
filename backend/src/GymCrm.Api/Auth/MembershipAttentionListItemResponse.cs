namespace GymCrm.Api.Auth;

internal sealed record MembershipAttentionListItemResponse(
    Guid ClientId,
    string FullName,
    string BehaviorKind,
    string MembershipName,
    DateOnly? ExpirationDate,
    int? DaysUntilExpiration,
    string State);
