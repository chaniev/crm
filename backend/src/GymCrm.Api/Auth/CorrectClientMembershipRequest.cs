namespace GymCrm.Api.Auth;

internal sealed record CorrectClientMembershipRequest(
    string? MembershipType,
    string? PurchaseDate,
    string? ExpirationDate,
    decimal? PaymentAmount,
    bool? IsPaid);
