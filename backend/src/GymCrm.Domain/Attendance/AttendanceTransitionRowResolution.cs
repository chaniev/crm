using GymCrm.Domain.Schedule;

namespace GymCrm.Domain.Attendance;

public class AttendanceTransitionRowResolution
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid ReportItemId { get; set; }
    public Guid AttendanceRowId { get; set; }
    public Guid TargetLessonOccurrenceId { get; set; }
    public string ResolutionKind { get; set; } = string.Empty;
    public Guid ResolvedByUserId { get; set; }
    public DateTimeOffset ResolvedAt { get; set; }
    public string? OperatorComment { get; set; }
    public string ResolutionDigest { get; set; } = string.Empty;

    public AttendanceTransitionRun Run { get; set; } = null!;
    public AttendanceTransitionReportItem ReportItem { get; set; } = null!;
    public Attendance AttendanceRow { get; set; } = null!;
    public LessonOccurrence TargetLessonOccurrence { get; set; } = null!;
}
