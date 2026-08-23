namespace GymCrm.Domain.Attendance;

public class AttendanceTransitionRun
{
    public Guid Id { get; set; }
    public DateOnly CutoverDate { get; set; }
    public string SourceSchemaVersion { get; set; } = string.Empty;
    public AttendanceTransitionRunStatus Status { get; set; } = AttendanceTransitionRunStatus.DryRun;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<AttendanceTransitionReportItem> ReportItems { get; set; } = new List<AttendanceTransitionReportItem>();
    public ICollection<AttendanceTransitionRowResolution> RowResolutions { get; set; } = new List<AttendanceTransitionRowResolution>();
}
