using GymCrm.Domain.Users;

namespace GymCrm.Domain.Groups;

public class GroupTrainerSubstitution
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid SubstituteTrainerId { get; set; }
    public DateOnly StartsOn { get; set; }
    public DateOnly EndsOn { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    public TrainingGroup Group { get; set; } = null!;
    public User SubstituteTrainer { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
