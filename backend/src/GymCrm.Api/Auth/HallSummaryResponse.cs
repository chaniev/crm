namespace GymCrm.Api.Auth;

internal sealed record HallSummaryResponse(
    Guid Id,
    Guid BranchId,
    string Name,
    bool IsArchived);
