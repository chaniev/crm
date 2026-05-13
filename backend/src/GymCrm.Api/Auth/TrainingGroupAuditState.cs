namespace GymCrm.Api.Auth;

internal sealed record TrainingGroupAuditState(
    Guid Id,
    string Name,
    Guid BranchId,
    Guid HallId,
    Guid GroupTypeId,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays,
    bool IsActive,
    IReadOnlyList<Guid> TrainerIds,
    int ClientCount,
    DateTimeOffset UpdatedAt);
