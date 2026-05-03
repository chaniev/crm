namespace GymCrm.Api.Auth;

internal sealed record ClientGroupSummaryResponse(
    Guid Id,
    string Name,
    bool IsActive,
    string TrainingStartTime,
    string ScheduleText);
