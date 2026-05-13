namespace GymCrm.Api.Auth;

internal sealed record UpsertGroupTypeRequest(
    string Name,
    string? Description,
    string SystemIdentifier);
