namespace GymCrm.Api.Auth;

internal sealed record MarkMembershipPaymentRequest(
    string? MembershipType,
    decimal? PaymentAmount,
    bool? IsPaid);
