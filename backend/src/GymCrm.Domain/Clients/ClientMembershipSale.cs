using GymCrm.Domain.Users;

namespace GymCrm.Domain.Clients;

public class ClientMembershipSale
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public MembershipType MembershipType { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public decimal GrossAmount { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<ClientMembership> Memberships { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembershipRefund> Refunds { get; set; } = new List<ClientMembershipRefund>();
}
