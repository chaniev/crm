using Crm.Domain.Users;

namespace Crm.Domain.Clients;

public class ClientMembership
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public MembershipType MembershipType { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public decimal PaymentAmount { get; set; }
    public bool IsPaid { get; set; }
    public bool SingleVisitUsed { get; set; }
    public Guid? PaidByUserId { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public ClientMembershipChangeReason ChangeReason { get; set; }
    public Guid ChangedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public User? PaidByUser { get; set; }
    public User ChangedByUser { get; set; } = null!;
}
