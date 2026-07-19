using GymCrm.Domain.Users;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Domain.Clients;

public class ClientMissedTrainingAcknowledgement
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid LastAttendanceId { get; set; }
    public DateOnly LastTrainingDate { get; set; }
    public TimeOnly LastTrainingStartTime { get; set; }
    public DateTimeOffset AcknowledgedAt { get; set; }
    public Guid AcknowledgedByUserId { get; set; }

    public Client Client { get; set; } = null!;
    public AttendanceEntry LastAttendance { get; set; } = null!;
    public User AcknowledgedByUser { get; set; } = null!;
}
