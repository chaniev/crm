using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Messenger;

public class ClientMessengerReadState
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public MessengerPlatform Platform { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset LastReadAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public User User { get; set; } = null!;
}
