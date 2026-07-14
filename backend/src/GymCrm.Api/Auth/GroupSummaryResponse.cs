namespace GymCrm.Api.Auth;

internal sealed record GroupSummaryResponse(
    int TotalCount,
    int ActiveWithoutTrainerCount);
