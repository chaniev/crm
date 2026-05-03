namespace GymCrm.Api.Auth;

internal sealed record RenewClientMembershipRequest(
    string? MembershipType,
    string? RenewalDate,
    string? ExpirationDate,
    decimal? PaymentAmount,
    bool? IsPaid);
