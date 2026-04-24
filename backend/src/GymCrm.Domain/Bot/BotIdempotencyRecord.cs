namespace GymCrm.Domain.Bot;

public class BotIdempotencyRecord
{
    public Guid Id { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string PlatformUserIdHash { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
    public string? ResponseJson { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
