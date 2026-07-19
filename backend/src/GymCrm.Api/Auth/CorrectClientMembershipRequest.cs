namespace GymCrm.Api.Auth;

internal sealed record CorrectClientMembershipRequest(
    string? PurchaseDate,
    string? ExpirationDate,
    bool? IsPaid);
