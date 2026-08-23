namespace GymCrm.Domain.Schedule;

public class ScheduleMutationConfirmationToken
{
    public Guid Id { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public Guid ActorUserId { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
}
