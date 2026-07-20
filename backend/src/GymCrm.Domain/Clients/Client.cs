using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Domain.Clients;

public class Client
{
    public const int NotesMaxLength = 2000;

    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public string? LastName { get; set; }
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? PhotoPath { get; set; }
    public string? PhotoContentType { get; set; }
    public long? PhotoSizeBytes { get; set; }
    public DateTimeOffset? PhotoUploadedAt { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }


    public Branch Branch { get; set; } = null!;
    public ICollection<ClientContact> Contacts { get; set; } = new List<ClientContact>();
    public ICollection<ClientMembership> Memberships { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembershipSale> MembershipSales { get; set; } = new List<ClientMembershipSale>();
    public ICollection<ClientMembershipRefund> MembershipRefunds { get; set; } = new List<ClientMembershipRefund>();
    public ICollection<ClientBranchAssignment> BranchAssignments { get; set; } = new List<ClientBranchAssignment>();
    public ICollection<ClientGroupAssignment> GroupAssignments { get; set; } = new List<ClientGroupAssignment>();
    public ICollection<ClientGroup> Groups { get; set; } = new List<ClientGroup>();
    public ICollection<AttendanceEntry> AttendanceEntries { get; set; } = new List<AttendanceEntry>();
    public ICollection<ClientMissedTrainingAcknowledgement> MissedTrainingAcknowledgements { get; set; } = new List<ClientMissedTrainingAcknowledgement>();
    public ICollection<ClientMessengerAccount> MessengerAccounts { get; set; } = new List<ClientMessengerAccount>();
    public ICollection<ClientMessengerLinkToken> MessengerLinkTokens { get; set; } = new List<ClientMessengerLinkToken>();
    public ICollection<ClientMessengerMessage> MessengerMessages { get; set; } = new List<ClientMessengerMessage>();
    public ICollection<ClientMessengerReadState> MessengerReadStates { get; set; } = new List<ClientMessengerReadState>();
}
