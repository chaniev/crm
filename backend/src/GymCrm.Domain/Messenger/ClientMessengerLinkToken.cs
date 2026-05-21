using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Messenger;

public class ClientMessengerLinkToken
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public MessengerPlatform Platform { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public string? UsedByPlatformUserIdHash { get; set; }

    public Client Client { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
