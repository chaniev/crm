using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Messenger;

public class ClientMessengerMessage
{
    public const int TextMaxLength = 4000;
    public const int FailureReasonMaxLength = 1000;

    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid? AccountId { get; set; }
    public MessengerPlatform Platform { get; set; }
    public ClientMessengerMessageDirection Direction { get; set; }
    public ClientMessengerMessageStatus Status { get; set; }
    public string Text { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public long? TelegramUpdateId { get; set; }
    public long? TelegramMessageId { get; set; }
    public string? TelegramChatId { get; set; }
    public string? TelegramUserIdHash { get; set; }
    public string? IdempotencyKey { get; set; }
    public string? IdempotencyPayloadHash { get; set; }
    public string? FailureReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? FailedAt { get; set; }

    public Client Client { get; set; } = null!;
    public ClientMessengerAccount? Account { get; set; }
    public User? CreatedByUser { get; set; }
}
