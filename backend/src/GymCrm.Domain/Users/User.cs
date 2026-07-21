using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Branches;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Domain.Users;

public class User
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Login { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public MessengerPlatform? MessengerPlatform { get; set; }
    public string? MessengerPlatformUserId { get; set; }
    public bool MustChangePassword { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }

    public ICollection<GroupTrainer> AssignedGroups { get; set; } = new List<GroupTrainer>();
    public ICollection<GroupTrainerAssignment> GroupTrainerAssignments { get; set; } = new List<GroupTrainerAssignment>();
    public ICollection<ClientMembership> MembershipPayments { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembership> MembershipChanges { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembershipSale> CreatedMembershipSales { get; set; } = new List<ClientMembershipSale>();
    public ICollection<ClientMembershipRefund> CreatedMembershipRefunds { get; set; } = new List<ClientMembershipRefund>();
    public ICollection<ClientMembershipRefund> CanceledMembershipRefunds { get; set; } = new List<ClientMembershipRefund>();
    public ICollection<ClientBranchAssignment> CreatedClientBranchAssignments { get; set; } = new List<ClientBranchAssignment>();
    public ICollection<ClientGroupAssignment> CreatedClientGroupAssignments { get; set; } = new List<ClientGroupAssignment>();
    public ICollection<GroupTrainerAssignment> CreatedGroupTrainerAssignments { get; set; } = new List<GroupTrainerAssignment>();
    public ICollection<AttendanceEntry> AttendanceMarks { get; set; } = new List<AttendanceEntry>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<Client> ClientsWithNotesChanged { get; set; } = new List<Client>();
    public ICollection<ClientMessengerLinkToken> CreatedMessengerLinkTokens { get; set; } = new List<ClientMessengerLinkToken>();
    public ICollection<ClientMessengerMessage> CreatedMessengerMessages { get; set; } = new List<ClientMessengerMessage>();
    public ICollection<ClientMessengerReadState> ClientMessengerReadStates { get; set; } = new List<ClientMessengerReadState>();
}
