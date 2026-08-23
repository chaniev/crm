namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerAssignmentsPreviewRequest(
    IReadOnlyList<GroupTrainerAssignmentPeriodRequest>? Assignments,
    string? ExpectedRevision);

internal sealed record GroupTrainerAssignmentsExecuteRequest(
    IReadOnlyList<GroupTrainerAssignmentPeriodRequest>? Assignments,
    string? ExpectedRevision,
    string? ConfirmationToken);

internal sealed record GroupTrainerAssignmentPeriodRequest(
    Guid? TrainerId,
    string? ValidFrom,
    string? ValidTo);

internal sealed record GroupTrainerAssignmentsPreviewResponse(
    string ConfirmationToken,
    DateTimeOffset ExpiresAt,
    string Revision,
    IReadOnlyList<GroupTrainerAssignmentPeriodResponse> Assignments,
    GroupTrainerAssignmentImpactResponse Impact,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record GroupTrainerAssignmentsExecuteResponse(
    string Revision,
    IReadOnlyList<GroupTrainerAssignmentPeriodResponse> Assignments,
    GroupTrainerAssignmentImpactResponse Impact,
    IReadOnlyList<ScheduleWarningResponse> Warnings);

internal sealed record GroupTrainerAssignmentPeriodResponse(
    Guid TrainerId,
    string TrainerName,
    DateOnly ValidFrom,
    DateOnly? ValidTo);

internal sealed record GroupTrainerAssignmentImpactResponse(
    int TotalAffectedOccurrences,
    IReadOnlyList<GroupTrainerAssignmentAffectedOccurrenceResponse> Examples);

internal sealed record GroupTrainerAssignmentAffectedOccurrenceResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    string StartTime,
    Guid HallId,
    string HallName);
