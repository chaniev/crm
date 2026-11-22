using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;

namespace GymCrm.Tests;

internal static class AttendanceTestLessons
{
    public static LessonOccurrence OneOff(TrainingGroup group, DateOnly date, TimeOnly startTime)
    {
        var now = DateTimeOffset.UtcNow;
        return new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            HallId = group.HallId,
            LessonDate = date,
            StartTime = startTime,
            DurationMinutes = group.DurationMinutes,
            SourceKind = LessonOccurrenceSourceKind.OneOff,
            CreatedAt = now,
            UpdatedAt = now
        };
    }
}
