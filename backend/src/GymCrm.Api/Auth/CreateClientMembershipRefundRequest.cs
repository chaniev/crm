namespace GymCrm.Api.Auth;

internal sealed record CreateClientMembershipRefundRequest(
    decimal? Amount,
    string? RefundDate,
    string? Comment);
