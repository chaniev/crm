namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipRefundResponse(
    Guid Id,
    Guid SaleId,
    Guid ClientId,
    decimal Amount,
    DateOnly RefundDate,
    string? Comment,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CanceledAt,
    Guid? CanceledByUserId);
