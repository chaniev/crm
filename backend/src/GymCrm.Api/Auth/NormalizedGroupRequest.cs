namespace GymCrm.Api.Auth;

internal sealed record NormalizedGroupRequest(
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool? IsActive,
    IReadOnlyList<Guid>? RawTrainerIds,
    IReadOnlyList<Guid> TrainerIds);
