namespace GymCrm.Api.Auth;

internal sealed record UpsertHallRequest(
    Guid? BranchId,
    string? Name,
    string? Description);
