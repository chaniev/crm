namespace GymCrm.Domain.Clients;

public class ClientMembershipIdempotencyRecord
{
    public Guid Id { get; set; }
    public Guid ActorUserId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid ClientId { get; set; }
    public Guid? ResultMembershipId { get; set; }
    public Guid? ResultSaleId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
