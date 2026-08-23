namespace GymCrm.Api.Auth;

internal sealed record ScheduleLessonsResponse(
    DateOnly From,
    DateOnly To,
    IReadOnlyList<ScheduleLessonResponse> Items,
    ScheduleCapabilitiesResponse Capabilities,
    ScheduleFilterOptionsResponse FilterOptions);

internal sealed record ScheduleLessonResponse(
    Guid LessonOccurrenceId,
    string SourceKind,
    bool IsMaterialized,
    Guid? LessonSeriesId,
    DateOnly LessonDate,
    string StartTime,
    int DurationMinutes,
    string EndTime,
    Guid GroupId,
    string GroupName,
    Guid GroupTypeId,
    string GroupTypeName,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    IReadOnlyList<ScheduleLessonTrainerResponse> EffectiveTrainers,
    string Status,
    bool HasAttendanceMarks,
    ScheduleLessonAllowedActionsResponse AllowedActions,
    string Revision);

internal sealed record ScheduleLessonTrainerResponse(
    Guid TrainerId,
    string FullName,
    string Kind,
    Guid? ReplacedTrainerId,
    Guid? SubstitutionId);

internal sealed record ScheduleLessonAllowedActionsResponse(
    ScheduleActionResponse ViewAttendance,
    ScheduleActionResponse EditAttendance,
    ScheduleActionResponse Edit,
    ScheduleActionResponse Move,
    ScheduleActionResponse Cancel,
    ScheduleActionResponse Restore,
    ScheduleActionResponse AssignTrainerSubstitution,
    ScheduleActionResponse CancelTrainerSubstitution);

internal sealed record ScheduleActionResponse(
    bool Allowed,
    string? Reason);

internal sealed record ScheduleCapabilitiesResponse(
    ScheduleActionResponse CreateOneOff);

internal sealed record ScheduleFilterOptionsResponse(
    IReadOnlyList<ScheduleFilterOptionResponse> Branches,
    IReadOnlyList<ScheduleFilterOptionResponse> Halls,
    IReadOnlyList<ScheduleFilterOptionResponse> Trainers,
    IReadOnlyList<ScheduleFilterOptionResponse> Groups,
    IReadOnlyList<ScheduleFilterOptionResponse> GroupTypes);

internal sealed record ScheduleFilterOptionResponse(
    Guid Id,
    string Name);

internal sealed record ScheduleOneOffLessonRequest(
    Guid? GroupId,
    string? LessonDate,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId);

internal sealed record ScheduleOneOffLessonExecuteRequest(
    Guid? GroupId,
    string? LessonDate,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId,
    string? ConfirmationToken);

internal sealed record ScheduleOneOffLessonPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    ScheduleLessonResponse Lesson,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record ScheduleWarningResponse(
    string Code,
    string Message);

internal sealed record ScheduleLessonMutationRequest(
    string? Revision);

internal sealed record ScheduleLessonCancellationPreviewRequest(
    string? Action,
    string? ExpectedRevision);

internal sealed record ScheduleLessonCancellationExecuteRequest(
    string? Action,
    string? ExpectedRevision,
    string? ConfirmationToken);

internal sealed record ScheduleLessonCancellationPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    string Action,
    ScheduleLessonResponse Lesson);

internal sealed record ScheduleLessonChangePreviewRequest(
    string? Scope,
    string? NewLessonDate,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId,
    string? ExpectedRevision);

internal sealed record ScheduleLessonChangeExecuteRequest(
    string? Scope,
    string? NewLessonDate,
    string? StartTime,
    int? DurationMinutes,
    Guid? HallId,
    string? ExpectedRevision,
    string? ConfirmationToken);

internal sealed record ScheduleLessonChangePreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    ScheduleLessonResponse Lesson,
    IReadOnlyList<ScheduleWarningResponse> Warnings,
    ScheduleLessonChangeImpactResponse Impact);

internal sealed record ScheduleLessonChangeImpactResponse(
    string Scope,
    DateOnly StartsOn,
    bool AffectsFutureProjection,
    IReadOnlyList<ScheduleLessonChangeSkippedOccurrenceResponse> Skipped);

internal sealed record ScheduleLessonChangeSkippedOccurrenceResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    string Reason);

internal sealed record ScheduleLessonTrainerSubstitutionTargetRequest(
    Guid? LessonOccurrenceId,
    string? LessonDate,
    string? ExpectedRevision);

internal sealed record ScheduleLessonTrainerSubstitutionPreviewRequest(
    Guid? ReplacedTrainerId,
    Guid? SubstituteTrainerId,
    IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetRequest>? Targets);

internal sealed record ScheduleLessonTrainerSubstitutionExecuteRequest(
    Guid? ReplacedTrainerId,
    Guid? SubstituteTrainerId,
    IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetRequest>? Targets,
    string? ConfirmationToken);

internal sealed record ScheduleLessonTrainerSubstitutionCancellationTargetRequest(
    Guid? LessonOccurrenceId,
    string? LessonDate,
    Guid? SubstitutionId,
    string? ExpectedRevision);

internal sealed record ScheduleLessonTrainerSubstitutionCancellationPreviewRequest(
    IReadOnlyList<ScheduleLessonTrainerSubstitutionCancellationTargetRequest>? Targets,
    string? Reason);

internal sealed record ScheduleLessonTrainerSubstitutionCancellationExecuteRequest(
    IReadOnlyList<ScheduleLessonTrainerSubstitutionCancellationTargetRequest>? Targets,
    string? Reason,
    string? ConfirmationToken);

internal sealed record ScheduleLessonTrainerSubstitutionPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetResponse> Targets,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record ScheduleLessonTrainerSubstitutionExecuteResponse(
    IReadOnlyList<ScheduleLessonResponse> Lessons,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record ScheduleLessonTrainerSubstitutionCancellationPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetResponse> Targets,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record ScheduleLessonTrainerSubstitutionCancellationExecuteResponse(
    IReadOnlyList<ScheduleLessonResponse> Lessons,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record ScheduleLessonTrainerSubstitutionTargetResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    Guid GroupId,
    string GroupName,
    Guid? SubstitutionId,
    IReadOnlyList<ScheduleWarningResponse> Warnings);
