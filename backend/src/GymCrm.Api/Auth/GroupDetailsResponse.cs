namespace GymCrm.Api.Auth;

internal sealed record GroupDetailsResponse(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    string TrainingStartTime,
    string ScheduleText,
    bool IsActive,
    IReadOnlyList<Guid> TrainerIds,
    IReadOnlyList<TrainerSummaryResponse> Trainers,
    int ClientCount,
    DateTimeOffset UpdatedAt);
