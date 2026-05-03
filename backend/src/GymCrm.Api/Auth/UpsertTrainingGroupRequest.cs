namespace GymCrm.Api.Auth;

internal sealed record UpsertTrainingGroupRequest(
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool? IsActive,
    IReadOnlyList<Guid>? TrainerIds);
