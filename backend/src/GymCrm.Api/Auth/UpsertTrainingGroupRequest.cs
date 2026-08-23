namespace GymCrm.Api.Auth;

internal sealed record UpsertTrainingGroupRequest(
    string Name,
    Guid? BranchId,
    Guid? HallId,
    Guid? GroupTypeId,
    string TrainingStartTime,
    int? DurationMinutes,
    int[]? Weekdays,
    bool? IsActive,
    IReadOnlyList<Guid>? TrainerIds,
    InitialLessonSeriesRequest? InitialLessonSeries = null,
    string? ConfirmationToken = null);

internal sealed record UpdateTrainingGroupIdentityRequest(
    string Name,
    Guid? BranchId,
    Guid? GroupTypeId,
    bool? IsActive);

internal sealed record InitialLessonSeriesRequest(
    string? StartsOn,
    string? EndsOn,
    IReadOnlyList<InitialLessonSeriesSlotRequest>? Slots);

internal sealed record InitialLessonSeriesSlotRequest(
    int? IsoWeekday,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId);

internal sealed record GroupPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    IReadOnlyList<ScheduleWarningResponse> Warnings);
