using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;

namespace GymCrm.Api.SeedData;

internal static class TestDataScheduleSeed
{
    public static List<LessonSeries> Create(
        IReadOnlyList<TrainingGroup> groups,
        DateOnly startsOn,
        DateTimeOffset now)
    {
        var result = new List<LessonSeries>(groups.Count);

        for (var index = 0; index < groups.Count; index++)
        {
            var group = groups[index];
            var groupNumber = index + 1;
            var series = new LessonSeries
            {
                Id = SeedIds.LessonSeries(groupNumber),
                GroupId = group.Id,
                StartsOn = startsOn,
                Version = 1,
                CreatedAt = now,
                UpdatedAt = now
            };
            var rule = new LessonScheduleRuleVersion
            {
                Id = SeedIds.LessonScheduleRuleVersion(groupNumber),
                LessonSeriesId = series.Id,
                VersionNumber = 1,
                EffectiveFrom = startsOn,
                CreatedAt = now
            };

            foreach (var isoWeekday in group.Weekdays.Order())
            {
                rule.Slots.Add(new LessonScheduleSlot
                {
                    Id = SeedIds.LessonScheduleSlot(groupNumber, isoWeekday),
                    LessonScheduleRuleVersionId = rule.Id,
                    SlotLineageId = SeedIds.LessonScheduleSlotLineage(groupNumber, isoWeekday),
                    IsoWeekday = isoWeekday,
                    StartTime = group.TrainingStartTime,
                    DurationMinutes = group.DurationMinutes,
                    HallId = group.HallId,
                    CreatedAt = now
                });
            }

            series.RuleVersions.Add(rule);
            result.Add(series);
        }

        return result;
    }
}
