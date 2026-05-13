namespace GymCrm.Api.Auth;

internal sealed record NormalizedGroupRequest(
    string Name,
    Guid? BranchId,
    Guid? HallId,
    Guid? GroupTypeId,
    string TrainingStartTime,
    int? DurationMinutes,
    IReadOnlyList<int>? RawWeekdays,
    int[] Weekdays,
    bool? IsActive,
    IReadOnlyList<Guid>? RawTrainerIds,
    IReadOnlyList<Guid> TrainerIds);
