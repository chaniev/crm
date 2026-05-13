using GymCrm.Domain.Branches;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Domain.Groups;

public class TrainingGroup
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public Guid HallId { get; set; }
    public Guid GroupTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeOnly TrainingStartTime { get; set; }
    public string ScheduleText { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Branch Branch { get; set; } = null!;
    public Hall Hall { get; set; } = null!;
    public GroupType GroupType { get; set; } = null!;
    public ICollection<ClientGroup> Clients { get; set; } = new List<ClientGroup>();
    public ICollection<GroupTrainer> Trainers { get; set; } = new List<GroupTrainer>();
    public ICollection<AttendanceEntry> AttendanceEntries { get; set; } = new List<AttendanceEntry>();
}
