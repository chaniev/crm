using GymCrm.Application.Scheduling;

namespace GymCrm.Tests;

public sealed class ScheduleTimeRangePolicyTests
{
    [Theory]
    [InlineData("10:00", 60, "10:30", 30, true)]
    [InlineData("10:00", 60, "11:00", 30, false)]
    [InlineData("10:00", 60, "09:00", 60, false)]
    public void Overlap_uses_half_open_local_time_ranges(
        string firstStart,
        int firstDuration,
        string secondStart,
        int secondDuration,
        bool expected)
    {
        Assert.Equal(
            expected,
            ScheduleTimeRangePolicy.Overlaps(
                TimeOnly.Parse(firstStart),
                firstDuration,
                TimeOnly.Parse(secondStart),
                secondDuration));
    }

    [Theory]
    [InlineData("22:00", 60, true)]
    [InlineData("23:30", 60, false)]
    public void Ends_on_same_day_rejects_wrapping_lessons(string startTime, int duration, bool expected)
    {
        Assert.Equal(expected, ScheduleTimeRangePolicy.EndsOnSameDay(TimeOnly.Parse(startTime), duration));
    }
}
