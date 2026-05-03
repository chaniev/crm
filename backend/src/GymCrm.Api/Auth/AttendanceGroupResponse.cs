namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupResponse(
    Guid Id,
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    int ClientCount);
