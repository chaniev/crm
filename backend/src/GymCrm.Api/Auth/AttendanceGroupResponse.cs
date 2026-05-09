namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupResponse(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    int ClientCount);
