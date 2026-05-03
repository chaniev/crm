namespace GymCrm.Api.Auth;

internal sealed record GroupDetailsResponse(
    Guid Id,
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    IReadOnlyList<Guid> TrainerIds,
    IReadOnlyList<TrainerSummaryResponse> Trainers,
    int ClientCount,
    DateTimeOffset UpdatedAt);
