namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipSaleAuditState(
    Guid Id,
    Guid ClientId,
    Guid MembershipCatalogItemId,
    string BehaviorKind,
    DateOnly PurchaseDate,
    decimal GrossAmount,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);
