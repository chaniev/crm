namespace GymCrm.Application.Attendance;

public interface IAttendanceTransitionService
{
    Task<AttendanceTransitionRunResult> EnsureRunAsync(
        DateOnly cutoverDate,
        string sourceSchemaVersion,
        CancellationToken cancellationToken);

    Task<AttendanceTransitionActivationResult> ValidateActivationAsync(
        Guid runId,
        CancellationToken cancellationToken);

    Task<AttendanceTransitionResolutionResult> ResolveReportItemAsync(
        ResolveAttendanceTransitionReportItemCommand command,
        CancellationToken cancellationToken);

    Task<AttendanceTransitionResolutionResult> ResolveTrainerSubstitutionReportItemAsync(
        ResolveTrainerSubstitutionTransitionReportItemCommand command,
        CancellationToken cancellationToken);
}

public sealed record AttendanceTransitionRunResult(
    AttendanceTransitionRunError Error,
    Guid? RunId,
    int UnresolvedCount)
{
    public bool Succeeded => Error == AttendanceTransitionRunError.None;

    public static AttendanceTransitionRunResult Success(Guid runId, int unresolvedCount) =>
        new(AttendanceTransitionRunError.None, runId, unresolvedCount);

    public static AttendanceTransitionRunResult Failure(AttendanceTransitionRunError error) =>
        new(error, null, 0);
}

public enum AttendanceTransitionRunError
{
    None = 0,
    CutoverDateMismatch = 1,
    SourceSchemaVersionMissing = 2
}

public sealed record AttendanceTransitionActivationResult(
    bool CanActivate,
    int UnresolvedCount);

public sealed record ResolveAttendanceTransitionReportItemCommand(
    Guid ReportItemId,
    Guid OperatorUserId,
    Guid? TargetLessonOccurrenceId,
    IReadOnlyList<Guid> AttendanceRowIds,
    string? OperatorComment,
    CreateLegacyAttendanceOccurrenceCommand? LegacyOccurrence = null);

public sealed record CreateLegacyAttendanceOccurrenceCommand(
    Guid GroupId,
    DateOnly LessonDate,
    TimeOnly StartTime,
    int DurationMinutes,
    Guid HallId,
    string Provenance,
    IReadOnlyList<Guid> PermanentTrainerAssignmentIds,
    IReadOnlyList<Guid> SubstitutionIds);

public sealed record ResolveTrainerSubstitutionTransitionReportItemCommand(
    Guid ReportItemId,
    Guid OperatorUserId,
    Guid TargetLessonOccurrenceId,
    Guid ReplacedTrainerId,
    Guid SubstituteTrainerId,
    Guid SourceGroupTrainerSubstitutionId,
    string? OperatorComment);

public sealed record AttendanceTransitionResolutionResult(
    AttendanceTransitionResolutionError Error,
    bool ReportItemResolved,
    int RemainingRowCount)
{
    public bool Succeeded => Error == AttendanceTransitionResolutionError.None;

    public static AttendanceTransitionResolutionResult Success(bool reportItemResolved, int remainingRowCount) =>
        new(AttendanceTransitionResolutionError.None, reportItemResolved, remainingRowCount);

    public static AttendanceTransitionResolutionResult Failure(AttendanceTransitionResolutionError error) =>
        new(error, false, 0);
}

public enum AttendanceTransitionResolutionError
{
    None = 0,
    ReportItemMissing = 1,
    InvalidRequest = 2,
    TargetOccurrenceMissing = 3,
    AttendanceRowsOutsideReport = 4,
    AttendanceRowAlreadyMapped = 5
}
