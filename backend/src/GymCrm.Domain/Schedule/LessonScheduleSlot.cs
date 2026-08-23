using GymCrm.Domain.Branches;

namespace GymCrm.Domain.Schedule;

public class LessonScheduleSlot
{
    public Guid Id { get; set; }
    public Guid LessonScheduleRuleVersionId { get; set; }
    public Guid SlotLineageId { get; set; }
    public int IsoWeekday { get; set; }
    public TimeOnly StartTime { get; set; }
    public int DurationMinutes { get; set; }
    public Guid HallId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public LessonScheduleRuleVersion RuleVersion { get; set; } = null!;
    public Hall Hall { get; set; } = null!;
}
