namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipSaleAuditState(
    Guid Id,
    Guid ClientId,
    string MembershipType,
    DateOnly PurchaseDate,
    decimal GrossAmount,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);
