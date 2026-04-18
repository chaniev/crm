using GymCrm.Domain.Clients;

namespace GymCrm.Domain.Groups;

public class ClientGroup
{
    public Guid ClientId { get; set; }
    public Guid GroupId { get; set; }

    public Client Client { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
}
