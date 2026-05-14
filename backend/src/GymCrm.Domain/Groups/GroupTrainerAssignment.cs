using GymCrm.Domain.Users;

namespace GymCrm.Domain.Groups;

public class GroupTrainerAssignment
{
    public Guid Id { get; set; }
    public Guid TrainerId { get; set; }
    public Guid GroupId { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly? ValidTo { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User Trainer { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
