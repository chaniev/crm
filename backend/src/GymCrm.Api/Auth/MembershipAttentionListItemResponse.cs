namespace GymCrm.Api.Auth;

internal sealed record MembershipAttentionListItemResponse(
    Guid ClientId,
    string FullName,
    Guid MembershipId,
    Guid SaleId,
    string BehaviorKind,
    string MembershipName,
    DateOnly? ExpirationDate,
    int? DaysUntilExpiration,
    IReadOnlyList<ClientMembershipTargetGroupResponse> TargetGroups,
    string State);
