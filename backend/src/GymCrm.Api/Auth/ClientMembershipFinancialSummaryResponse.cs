namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipFinancialSummaryResponse(
    decimal GrossAmount,
    decimal RefundedAmount,
    decimal NetAmount,
    string RefundStatus,
    DateOnly? LastRefundDate);
