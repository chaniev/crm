using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Messenger;

public class ClientMessengerAccount
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public MessengerPlatform Platform { get; set; }
    public string PlatformUserId { get; set; } = string.Empty;
    public string PlatformUserIdHash { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? DisplayName { get; set; }
    public DateTimeOffset LinkedAt { get; set; }
    public DateTimeOffset? UnlinkedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public ICollection<ClientMessengerMessage> Messages { get; set; } = new List<ClientMessengerMessage>();
}
