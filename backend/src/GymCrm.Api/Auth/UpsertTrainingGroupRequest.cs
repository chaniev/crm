namespace GymCrm.Api.Auth;

internal sealed record UpsertTrainingGroupRequest(
    string Name,
    Guid? BranchId,
    Guid? HallId,
    Guid? GroupTypeId,
    string TrainingStartTime,
    string ScheduleText,
    bool? IsActive,
    IReadOnlyList<Guid>? TrainerIds);
