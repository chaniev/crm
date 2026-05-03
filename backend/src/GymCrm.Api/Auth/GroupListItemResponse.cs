namespace GymCrm.Api.Auth;

internal sealed record GroupListItemResponse(
    Guid Id,
    string Name,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    IReadOnlyList<TrainerSummaryResponse> Trainers,
    IReadOnlyList<Guid> TrainerIds,
    int TrainerCount,
    IReadOnlyList<string> TrainerNames,
    int ClientCount,
    DateTimeOffset UpdatedAt);
