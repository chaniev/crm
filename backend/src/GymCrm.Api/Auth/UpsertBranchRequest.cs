namespace GymCrm.Api.Auth;

internal sealed record UpsertBranchRequest(
    string? Name,
    string? Address,
    string? Description);
