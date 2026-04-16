using Crm.Domain.Audit;
using Crm.Domain.Clients;
using Crm.Domain.Groups;
using AttendanceEntry = Crm.Domain.Attendance.Attendance;

namespace Crm.Domain.Users;

public class User
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Login { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool MustChangePassword { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<GroupTrainer> AssignedGroups { get; set; } = new List<GroupTrainer>();
    public ICollection<ClientMembership> MembershipPayments { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembership> MembershipChanges { get; set; } = new List<ClientMembership>();
    public ICollection<AttendanceEntry> AttendanceMarks { get; set; } = new List<AttendanceEntry>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
