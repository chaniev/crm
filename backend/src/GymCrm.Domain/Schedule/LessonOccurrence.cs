using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Schedule;

public class LessonOccurrence
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public DateOnly LessonDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public int DurationMinutes { get; set; }
    public Guid HallId { get; set; }
    public Guid? SourceLessonSeriesId { get; set; }
    public Guid? SourceRuleVersionId { get; set; }
    public Guid? SourceSlotId { get; set; }
    public Guid? SourceSlotLineageId { get; set; }
    public DateOnly? ProjectedDate { get; set; }
    public LessonOccurrenceStatus Status { get; set; } = LessonOccurrenceStatus.Scheduled;
    public LessonOccurrenceSourceKind SourceKind { get; set; } = LessonOccurrenceSourceKind.Recurring;
    public uint Version { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public TrainingGroup Group { get; set; } = null!;
    public Hall Hall { get; set; } = null!;
    public LessonSeries? SourceLessonSeries { get; set; }
    public LessonScheduleRuleVersion? SourceRuleVersion { get; set; }
    public LessonScheduleSlot? SourceSlot { get; set; }
    public ICollection<LessonOccurrenceTrainerSubstitution> TrainerSubstitutions { get; set; } = new List<LessonOccurrenceTrainerSubstitution>();
}
