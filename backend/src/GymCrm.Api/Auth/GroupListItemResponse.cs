namespace GymCrm.Api.Auth;

internal sealed record GroupListItemResponse(
    Guid Id,
    string Name,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    Guid GroupTypeId,
    string GroupTypeName,
    string TrainingStartTime,
    int DurationMinutes,
    IReadOnlyList<int> Weekdays,
    bool IsActive,
    IReadOnlyList<TrainerSummaryResponse> Trainers,
    IReadOnlyList<Guid> TrainerIds,
    int TrainerCount,
    IReadOnlyList<string> TrainerNames,
    int ClientCount,
    DateTimeOffset UpdatedAt);
