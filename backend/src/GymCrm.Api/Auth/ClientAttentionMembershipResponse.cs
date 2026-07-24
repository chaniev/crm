namespace GymCrm.Api.Auth;

internal sealed record ClientAttentionMembershipResponse(
    string BehaviorKind,
    string MembershipName,
    DateOnly? ExpirationDate,
    int? DaysUntilExpiration);
