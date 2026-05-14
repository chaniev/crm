using GymCrm.Domain.Users;

namespace GymCrm.Domain.Clients;

public class ClientMembershipRefund
{
    public const int CommentMaxLength = 1000;

    public Guid Id { get; set; }
    public Guid SaleId { get; set; }
    public Guid ClientId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly RefundDate { get; set; }
    public string? Comment { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CanceledAt { get; set; }
    public Guid? CanceledByUserId { get; set; }

    public ClientMembershipSale Sale { get; set; } = null!;
    public Client Client { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public User? CanceledByUser { get; set; }
}
