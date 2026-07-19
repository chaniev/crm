using GymCrm.Application.Attendance;

namespace GymCrm.Tests;

public class MissedTrainingStreakCalculatorTests
{
    private readonly MissedTrainingStreakCalculator _calculator = new();

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(2, 2)]
    [InlineData(3, 3)]
    [InlineData(4, 4)]
    public void Counts_the_current_absent_streak(int absentCount, int expected)
    {
        Assert.Equal(expected, _calculator.Calculate(CreateAbsentEvents(absentCount)));
    }

    [Fact]
    public void Present_breaks_the_streak_and_unmarked_is_ignored()
    {
        var events = new[]
        {
            Event(0, AttendanceState.Absent),
            Event(1, AttendanceState.Absent),
            Event(2, AttendanceState.Unmarked),
            Event(3, AttendanceState.Present),
            Event(4, AttendanceState.Absent),
            Event(5, AttendanceState.Unmarked),
            Event(6, AttendanceState.Absent)
        };

        Assert.Equal(2, _calculator.Calculate(events));
    }

    [Fact]
    public void Same_day_events_are_ordered_by_time_and_stable_id()
    {
        var date = new DateOnly(2026, 7, 1);
        var markedAt = new DateTimeOffset(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);
        var firstId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var secondId = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var events = new[]
        {
            new MissedTrainingAttendanceEvent(secondId, date, new TimeOnly(10, 0), AttendanceState.Absent, markedAt),
            new MissedTrainingAttendanceEvent(firstId, date, new TimeOnly(10, 0), AttendanceState.Present, markedAt),
            new MissedTrainingAttendanceEvent(Guid.NewGuid(), date, new TimeOnly(11, 0), AttendanceState.Absent, markedAt)
        };

        Assert.Equal(2, _calculator.Calculate(events));
    }

    [Fact]
    public void Correction_recalculates_from_current_states()
    {
        var events = CreateAbsentEvents(3).ToArray();
        Assert.Equal(3, _calculator.Calculate(events));

        events[1] = events[1] with { State = AttendanceState.Present };
        Assert.Equal(1, _calculator.Calculate(events));
        events[1] = events[1] with { State = AttendanceState.Unmarked };
        Assert.Equal(2, _calculator.Calculate(events));
    }

    [Fact]
    public void Acknowledgement_requires_three_new_absences_and_ignores_old_corrections()
    {
        var old = CreateAbsentEvents(3).ToArray();
        var acknowledgedAt = old.Max(candidate => candidate.MarkedAt).AddMinutes(1);
        var boundary = new MissedTrainingAcknowledgementBoundary(
            old[^1].AttendanceId,
            old[^1].TrainingDate,
            old[^1].TrainingStartTime,
            acknowledgedAt);

        old[0] = old[0] with { State = AttendanceState.Present };
        var twoNew = old.Concat(new[]
        {
            Event(3, AttendanceState.Absent, acknowledgedAt.AddMinutes(1)),
            Event(4, AttendanceState.Absent, acknowledgedAt.AddMinutes(2))
        });
        Assert.Equal(2, _calculator.Calculate(twoNew, boundary));

        var threeNew = twoNew.Append(Event(5, AttendanceState.Absent, acknowledgedAt.AddMinutes(3)));
        Assert.Equal(3, _calculator.Calculate(threeNew, boundary));
    }

    [Fact]
    public void Backdated_row_and_pre_acknowledgement_row_moved_by_group_time_stay_before_boundary()
    {
        var acknowledgedAt = new DateTimeOffset(2026, 7, 10, 12, 0, 0, TimeSpan.Zero);
        var boundary = new MissedTrainingAcknowledgementBoundary(
            Guid.Parse("00000000-0000-0000-0000-000000000010"),
            new DateOnly(2026, 7, 10),
            new TimeOnly(10, 0),
            acknowledgedAt);
        var events = new[]
        {
            new MissedTrainingAttendanceEvent(Guid.NewGuid(), new DateOnly(2026, 7, 9), new TimeOnly(9, 0), AttendanceState.Absent, acknowledgedAt.AddHours(1)),
            new MissedTrainingAttendanceEvent(Guid.NewGuid(), new DateOnly(2026, 7, 10), new TimeOnly(12, 0), AttendanceState.Absent, acknowledgedAt.AddHours(-1)),
            new MissedTrainingAttendanceEvent(Guid.NewGuid(), new DateOnly(2026, 7, 11), new TimeOnly(9, 0), AttendanceState.Absent, acknowledgedAt.AddHours(1))
        };

        Assert.Equal(1, _calculator.Calculate(events, boundary));
    }

    private static IEnumerable<MissedTrainingAttendanceEvent> CreateAbsentEvents(int count) =>
        Enumerable.Range(0, count).Select(index => Event(index, AttendanceState.Absent));

    private static MissedTrainingAttendanceEvent Event(
        int dayOffset,
        AttendanceState state,
        DateTimeOffset? markedAt = null) => new(
        Guid.Parse($"00000000-0000-0000-0000-{dayOffset + 1:D12}"),
        new DateOnly(2026, 7, 1).AddDays(dayOffset),
        new TimeOnly(10, 0),
        state,
        markedAt ?? new DateTimeOffset(2026, 7, 1, 12, 0, 0, TimeSpan.Zero).AddDays(dayOffset));
}
