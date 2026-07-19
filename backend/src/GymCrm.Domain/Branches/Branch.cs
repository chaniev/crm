using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;

namespace GymCrm.Domain.Branches;

public class Branch
{
    public const int NameMaxLength = 128;
    public const int AddressMaxLength = 256;
    public const int DescriptionMaxLength = 1000;

    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Description { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Hall> Halls { get; set; } = new List<Hall>();
    public ICollection<Client> Clients { get; set; } = new List<Client>();
    public ICollection<ClientBranchAssignment> ClientAssignments { get; set; } = new List<ClientBranchAssignment>();
    public ICollection<TrainingGroup> Groups { get; set; } = new List<TrainingGroup>();
    public ICollection<MembershipCatalogItem> MembershipCatalogItems { get; set; } = new List<MembershipCatalogItem>();
}
