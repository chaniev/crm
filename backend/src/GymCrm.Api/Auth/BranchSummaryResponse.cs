namespace GymCrm.Api.Auth;

internal sealed record BranchSummaryResponse(
    Guid Id,
    string Name,
    bool IsArchived);
