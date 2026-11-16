using GymCrm.Application.Attendance;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Scheduling;

public static class ScheduleLessonProjector
{
    public static IEnumerable<ScheduleLessonFacts> Project(
        IEnumerable<LessonSeries> series,
        IReadOnlyList<LessonOccurrence> materialized,
        DateOnly from,
        DateOnly to,
        UserRole actorRole,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks)
    {
        var materializedById = materialized.ToDictionary(occurrence => occurrence.Id);
        var yieldedIds = new HashSet<Guid>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var weekday = ToIsoWeekday(date);
            foreach (var candidate in series)
            {
                if (date < candidate.StartsOn || (candidate.EndsOn is not null && date > candidate.EndsOn.Value))
                {
                    continue;
                }

                foreach (var version in candidate.RuleVersions
                    .Where(version =>
                        version.EffectiveFrom <= date &&
                        (version.EffectiveTo is null || version.EffectiveTo >= date))
                    .OrderBy(version => version.VersionNumber))
                {
                    foreach (var slot in version.Slots
                        .Where(slot => slot.IsoWeekday == weekday)
                        .OrderBy(slot => slot.StartTime)
                        .ThenBy(slot => slot.Id))
                    {
                        var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, date);
                        if (materializedById.TryGetValue(occurrenceId, out var occurrence))
                        {
                            if (occurrence.LessonDate == date)
                            {
                                var materializedLesson = FromOccurrence(
                                    occurrence,
                                    actorRole,
                                    attendanceDatePolicy,
                                    attendanceMarks);
                                yieldedIds.Add(materializedLesson.LessonOccurrenceId);
                                yield return materializedLesson;
                            }

                            continue;
                        }

                        var lesson = FromRecurring(
                                candidate,
                                version,
                                slot,
                                date,
                                actorRole,
                                attendanceDatePolicy,
                                attendanceMarks);
                        yieldedIds.Add(lesson.LessonOccurrenceId);
                        yield return lesson;
                    }
                }
            }
        }

        foreach (var occurrence in materialized
            .Where(occurrence =>
                !yieldedIds.Contains(occurrence.Id) &&
                occurrence.LessonDate >= from &&
                occurrence.LessonDate <= to)
            .OrderBy(occurrence => occurrence.LessonDate)
            .ThenBy(occurrence => occurrence.StartTime)
            .ThenBy(occurrence => occurrence.Id))
        {
            yieldedIds.Add(occurrence.Id);
            yield return FromOccurrence(occurrence, actorRole, attendanceDatePolicy, attendanceMarks);
        }
    }

    public static ScheduleLessonFacts FromOccurrence(
        LessonOccurrence occurrence,
        UserRole actorRole,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks) => Create(
            occurrence.Id, occurrence.SourceKind, true, occurrence.SourceLessonSeriesId,
            occurrence.LessonDate, occurrence.StartTime, occurrence.DurationMinutes, occurrence.Group, occurrence.Hall,
            occurrence.Status, actorRole, attendanceDatePolicy, attendanceMarks,
            $"{occurrence.Id:D}:{occurrence.Version}", occurrence.TrainerSubstitutions);

    public static ScheduleLessonFacts FromRecurring(
        LessonSeries series,
        LessonScheduleRuleVersion version,
        LessonScheduleSlot slot,
        DateOnly date,
        UserRole actorRole,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks) => Create(
            LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, date), LessonOccurrenceSourceKind.Recurring,
            false, series.Id, date, slot.StartTime, slot.DurationMinutes, series.Group, slot.Hall,
            LessonOccurrenceStatus.Scheduled, actorRole, attendanceDatePolicy, attendanceMarks,
            $"{series.Id:D}:{version.Id:D}:{slot.Id:D}:{slot.SlotLineageId:D}");

    public static ScheduleLessonFacts Create(
        Guid occurrenceId,
        LessonOccurrenceSourceKind sourceKind,
        bool isMaterialized,
        Guid? lessonSeriesId,
        DateOnly date,
        TimeOnly startTime,
        int durationMinutes,
        TrainingGroup group,
        Hall hall,
        LessonOccurrenceStatus status,
        UserRole actorRole,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks,
        string sourceRevision,
        IEnumerable<LessonOccurrenceTrainerSubstitution>? substitutions = null) => new(
            occurrenceId, sourceKind, isMaterialized, lessonSeriesId, date, startTime, durationMinutes,
            group.Id, group.Name, group.GroupTypeId, group.GroupType.Name, group.BranchId, group.Branch.Name,
            hall.Id, hall.Name, ResolveEffectiveTrainers(group, date, substitutions ?? []), status,
            attendanceMarks.Contains(occurrenceId), sourceRevision, true,
            status == LessonOccurrenceStatus.Scheduled && attendanceDatePolicy.IsAllowed(actorRole, date));

    public static IReadOnlyList<ScheduleEffectiveTrainer> ResolveEffectiveTrainers(
        GymCrm.Domain.Groups.TrainingGroup group,
        DateOnly lessonDate,
        IEnumerable<LessonOccurrenceTrainerSubstitution> substitutions)
    {
        var activeSubstitutions = substitutions
            .Where(substitution => substitution.CancelledAt == null)
            .GroupBy(substitution => substitution.ReplacedTrainerId)
            .Select(grouping => grouping.OrderBy(substitution => substitution.CreatedAt).ThenBy(substitution => substitution.Id).First())
            .ToDictionary(substitution => substitution.ReplacedTrainerId);

        var permanent = group.TrainerAssignments
            .Where(assignment =>
                assignment.ValidFrom <= lessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= lessonDate) &&
                !activeSubstitutions.ContainsKey(assignment.TrainerId))
            .Select(assignment => new ScheduleEffectiveTrainer(
                assignment.TrainerId,
                assignment.Trainer.FullName,
                ScheduleTrainerKind.Permanent,
                null,
                null));
        var substitute = activeSubstitutions.Values
            .Select(substitution => new ScheduleEffectiveTrainer(
                substitution.SubstituteTrainerId,
                substitution.SubstituteTrainer.FullName,
                ScheduleTrainerKind.Substitute,
                substitution.ReplacedTrainerId,
                substitution.Id));

        return permanent
            .Concat(substitute)
            .OrderBy(trainer => trainer.FullName)
            .ThenBy(trainer => trainer.TrainerId)
            .ToArray();
    }

    private static int ToIsoWeekday(DateOnly date) => date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
}
