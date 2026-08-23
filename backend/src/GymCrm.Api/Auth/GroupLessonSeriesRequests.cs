namespace GymCrm.Api.Auth;

internal sealed record GroupLessonSeriesPreviewRequest(
    string? Scope,
    string? EffectiveFrom,
    string? EndsOn,
    IReadOnlyList<GroupLessonSeriesSlotRequest>? Slots,
    string? ExpectedRevision);

internal sealed record GroupLessonSeriesExecuteRequest(
    string? Scope,
    string? EffectiveFrom,
    string? EndsOn,
    IReadOnlyList<GroupLessonSeriesSlotRequest>? Slots,
    string? ExpectedRevision,
    string? ConfirmationToken);

internal sealed record GroupLessonSeriesSlotRequest(
    int? IsoWeekday,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId);

internal sealed record GroupLessonSeriesPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    string Revision,
    string Scope,
    DateOnly EffectiveFrom,
    DateOnly? EndsOn,
    IReadOnlyList<GroupLessonSeriesSlotResponse> Slots,
    GroupLessonSeriesImpactResponse Impact,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record GroupLessonSeriesExecuteResponse(
    string Revision,
    string Scope,
    DateOnly EffectiveFrom,
    DateOnly? EndsOn,
    IReadOnlyList<GroupLessonSeriesSlotResponse> Slots,
    GroupLessonSeriesImpactResponse Impact,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record GroupLessonSeriesReadResponse(
    Guid SeriesId,
    Guid GroupId,
    string GroupName,
    DateOnly BusinessDate,
    DateOnly StartsOn,
    DateOnly? EndsOn,
    string Revision,
    GroupLessonSeriesCurrentVersionResponse CurrentVersion);

internal sealed record GroupLessonSeriesCurrentVersionResponse(
    int VersionNumber,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    DateOnly ThisAndFutureMinEffectiveFrom,
    DateOnly EntireSeriesEffectiveFrom,
    IReadOnlyList<GroupLessonSeriesSlotResponse> Slots);

internal sealed record GroupLessonSeriesSlotResponse(
    int IsoWeekday,
    string StartTime,
    int DurationMinutes,
    Guid HallId,
    string HallName);

internal sealed record GroupLessonSeriesImpactResponse(
    int TotalAffectedOccurrences,
    IReadOnlyList<GroupLessonSeriesAffectedOccurrenceResponse> Examples,
    IReadOnlyList<GroupLessonSeriesSkippedOccurrenceResponse> Skipped);

internal sealed record GroupLessonSeriesAffectedOccurrenceResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    string StartTime,
    Guid HallId,
    string HallName);

internal sealed record GroupLessonSeriesSkippedOccurrenceResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    string Reason);
