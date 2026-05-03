namespace GymCrm.Api.Auth;

internal sealed record NormalizedClientContactRequest(
    string Type,
    string FullName,
    string Phone);
