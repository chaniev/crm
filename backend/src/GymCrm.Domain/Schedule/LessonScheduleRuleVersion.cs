namespace GymCrm.Domain.Schedule;

public class LessonScheduleRuleVersion
{
    public Guid Id { get; set; }
    public Guid LessonSeriesId { get; set; }
    public int VersionNumber { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public LessonSeries LessonSeries { get; set; } = null!;
    public ICollection<LessonScheduleSlot> Slots { get; set; } = new List<LessonScheduleSlot>();
}
