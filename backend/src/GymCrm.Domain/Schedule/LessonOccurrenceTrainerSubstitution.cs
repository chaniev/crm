using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Schedule;

public class LessonOccurrenceTrainerSubstitution
{
    public Guid Id { get; set; }
    public Guid LessonOccurrenceId { get; set; }
    public Guid ReplacedTrainerId { get; set; }
    public Guid SubstituteTrainerId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public Guid? CancelledByUserId { get; set; }
    public string? CancellationReason { get; set; }
    public Guid? SourceGroupTrainerSubstitutionId { get; set; }

    public LessonOccurrence LessonOccurrence { get; set; } = null!;
    public User ReplacedTrainer { get; set; } = null!;
    public User SubstituteTrainer { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public User? UpdatedByUser { get; set; }
    public User? CancelledByUser { get; set; }
    public GroupTrainerSubstitution? SourceGroupTrainerSubstitution { get; set; }
}
