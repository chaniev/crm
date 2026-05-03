namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipResponse(
    Guid Id,
    string MembershipType,
    DateOnly PurchaseDate,
    DateOnly? ExpirationDate,
    decimal PaymentAmount,
    bool IsPaid,
    bool SingleVisitUsed,
    Guid? PaidByUserId,
    string? PaidByUserFullName,
    DateTimeOffset? PaidAt,
    string ChangeReason,
    DateTimeOffset ValidFrom,
    DateTimeOffset? ValidTo,
    DateTimeOffset CreatedAt);
