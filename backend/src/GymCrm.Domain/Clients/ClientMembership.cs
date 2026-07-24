using GymCrm.Domain.Users;
using GymCrm.Domain.Memberships;

namespace GymCrm.Domain.Clients;

public class ClientMembership
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid SaleId { get; set; }
    public MembershipBehaviorKind BehaviorKind { get; set; }
    public DateOnly? IndividualValidFrom { get; set; }
    public DateOnly? IndividualValidTo { get; set; }
    public string? ProfessionalComment { get; set; }
    public bool SingleVisitUsed { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public ClientMembershipChangeReason ChangeReason { get; set; }
    public Guid ChangedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public ClientMembershipSale Sale { get; set; } = null!;
    public User ChangedByUser { get; set; } = null!;
}
