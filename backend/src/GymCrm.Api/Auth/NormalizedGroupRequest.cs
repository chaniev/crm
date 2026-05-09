namespace GymCrm.Api.Auth;

internal sealed record NormalizedGroupRequest(
    string Name,
    Guid? BranchId,
    Guid? HallId,
    string TrainingStartTime,
    string ScheduleText,
    bool? IsActive,
    IReadOnlyList<Guid>? RawTrainerIds,
    IReadOnlyList<Guid> TrainerIds);
