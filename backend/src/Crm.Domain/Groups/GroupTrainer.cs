using Crm.Domain.Users;

namespace Crm.Domain.Groups;

public class GroupTrainer
{
    public Guid GroupId { get; set; }
    public Guid TrainerId { get; set; }

    public TrainingGroup Group { get; set; } = null!;
    public User Trainer { get; set; } = null!;
}
