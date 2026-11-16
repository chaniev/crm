namespace GymCrm.Application.Scheduling;

public sealed record ScheduleReadResult(
    IReadOnlyList<ScheduleLessonFacts> Lessons,
    ScheduleFilterOptions FilterOptions);
