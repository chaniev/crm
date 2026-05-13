namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupResponse(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays,
    bool IsActive,
    int ClientCount);
