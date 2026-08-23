using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Schedule;

public class LessonSeries
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public DateOnly StartsOn { get; set; }
    public DateOnly? EndsOn { get; set; }
    public uint Version { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public TrainingGroup Group { get; set; } = null!;
    public ICollection<LessonScheduleRuleVersion> RuleVersions { get; set; } = new List<LessonScheduleRuleVersion>();
}
