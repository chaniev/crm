namespace GymCrm.Api.Auth;

internal sealed record ClientAttentionMembershipResponse(
    Guid MembershipId,
    Guid SaleId,
    string BehaviorKind,
    string MembershipName,
    DateOnly? ExpirationDate,
    int? DaysUntilExpiration,
    IReadOnlyList<ClientMembershipTargetGroupResponse> TargetGroups);
