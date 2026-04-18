using GymCrm.Domain.Groups;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Domain.Clients;

public class Client
{
    public Guid Id { get; set; }
    public string? LastName { get; set; }
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? PhotoPath { get; set; }
    public string? PhotoContentType { get; set; }
    public long? PhotoSizeBytes { get; set; }
    public DateTimeOffset? PhotoUploadedAt { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<ClientContact> Contacts { get; set; } = new List<ClientContact>();
    public ICollection<ClientMembership> Memberships { get; set; } = new List<ClientMembership>();
    public ICollection<ClientGroup> Groups { get; set; } = new List<ClientGroup>();
    public ICollection<AttendanceEntry> AttendanceEntries { get; set; } = new List<AttendanceEntry>();
}
