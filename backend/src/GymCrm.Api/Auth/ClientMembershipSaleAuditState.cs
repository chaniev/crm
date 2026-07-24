namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipSaleAuditState(
    Guid Id,
    Guid ClientId,
    Guid? MembershipCatalogItemId,
    string MembershipName,
    string BehaviorKind,
    string PricingMode,
    DateOnly PurchaseDate,
    DateOnly PaymentDate,
    decimal GrossAmount,
    decimal? CatalogPrice,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);
