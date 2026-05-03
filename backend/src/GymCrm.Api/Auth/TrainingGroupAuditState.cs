namespace GymCrm.Api.Auth;

internal sealed record TrainingGroupAuditState(
    Guid Id,
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    IReadOnlyList<Guid> TrainerIds,
    int ClientCount,
    DateTimeOffset UpdatedAt);
