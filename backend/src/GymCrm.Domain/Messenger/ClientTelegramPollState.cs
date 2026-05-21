namespace GymCrm.Domain.Messenger;

public class ClientTelegramPollState
{
    public Guid Id { get; set; }
    public string BotName { get; set; } = string.Empty;
    public long? NextUpdateOffset { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
