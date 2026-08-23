namespace GymCrm.Domain.Attendance;

public class AttendanceTransitionReportItem
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid? GroupId { get; set; }
    public DateOnly? TrainingDate { get; set; }
    public string AttendanceRowIdsJson { get; set; } = "[]";
    public int RowCount { get; set; }
    public string ReasonCode { get; set; } = string.Empty;
    public AttendanceTransitionResolutionStatus ResolutionStatus { get; set; } = AttendanceTransitionResolutionStatus.Unresolved;
    public string? ResolutionKind { get; set; }
    public Guid? TargetLessonOccurrenceId { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? OperatorComment { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public AttendanceTransitionRun Run { get; set; } = null!;
    public ICollection<AttendanceTransitionRowResolution> RowResolutions { get; set; } =
        new List<AttendanceTransitionRowResolution>();
}
