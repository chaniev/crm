namespace GymCrm.Api.Auth;

internal sealed record PurchaseClientMembershipRequest(
    string? MembershipType,
    string? PurchaseDate,
    string? ExpirationDate,
    decimal? PaymentAmount,
    bool? IsPaid);
