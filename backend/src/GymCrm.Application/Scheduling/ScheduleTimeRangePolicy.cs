namespace GymCrm.Application.Scheduling;

public static class ScheduleTimeRangePolicy
{
    public static bool EndsOnSameDay(TimeOnly startTime, int durationMinutes)
    {
        return durationMinutes > 0 && startTime.AddMinutes(durationMinutes) > startTime;
    }

    public static bool Overlaps(
        TimeOnly firstStart,
        int firstDurationMinutes,
        TimeOnly secondStart,
        int secondDurationMinutes)
    {
        var firstEnd = firstStart.AddMinutes(firstDurationMinutes);
        var secondEnd = secondStart.AddMinutes(secondDurationMinutes);
        return firstStart < secondEnd && secondStart < firstEnd;
    }
}
