namespace GymCrm.Api.Auth;

internal sealed record UpsertClientContactRequest(
    string? Type,
    string? FullName,
    string? Phone);
