namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipAuditState(
    Guid Id,
    Guid ClientId,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid,
    bool SingleVisitUsed,
    Guid? PaidByUserId,
    DateTimeOffset? PaidAt,
    string ChangeReason,
    Guid ChangedByUserId,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    DateTimeOffset CreatedAt);
