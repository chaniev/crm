using GymCrm.Domain.Users;
using GymCrm.Domain.Memberships;

namespace GymCrm.Domain.Clients;

public class ClientMembershipSale
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid MembershipCatalogItemId { get; set; }
    public MembershipBehaviorKind BehaviorKind { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public decimal GrossAmount { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? Comment { get; set; }
    public Guid? CommentChangedByUserId { get; set; }
    public DateTimeOffset? CommentChangedAt { get; set; }

    public Client Client { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public User? CommentChangedByUser { get; set; }
    public MembershipCatalogItem MembershipCatalogItem { get; set; } = null!;
    public ICollection<ClientMembership> Memberships { get; set; } = new List<ClientMembership>();
    public ICollection<ClientMembershipRefund> Refunds { get; set; } = new List<ClientMembershipRefund>();
}
