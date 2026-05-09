namespace GymCrm.Api.Auth;

internal sealed record ClientGroupSummaryResponse(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    bool IsActive,
    string TrainingStartTime,
    string ScheduleText);
