namespace GymCrm.Api.Auth;

internal sealed record GroupDetailsResponse(
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
    IReadOnlyList<Guid> TrainerIds,
    IReadOnlyList<TrainerSummaryResponse> Trainers,
    int ClientCount,
    DateTimeOffset UpdatedAt,
    string TrainerAssignmentRevision,
    IReadOnlyList<GroupTrainerAssignmentPeriodResponse> TrainerAssignmentPeriods);
