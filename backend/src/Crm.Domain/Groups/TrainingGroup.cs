using AttendanceEntry = Crm.Domain.Attendance.Attendance;

namespace Crm.Domain.Groups;

public class TrainingGroup
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeOnly TrainingStartTime { get; set; }
    public string ScheduleText { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<ClientGroup> Clients { get; set; } = new List<ClientGroup>();
    public ICollection<GroupTrainer> Trainers { get; set; } = new List<GroupTrainer>();
    public ICollection<AttendanceEntry> AttendanceEntries { get; set; } = new List<AttendanceEntry>();
}
