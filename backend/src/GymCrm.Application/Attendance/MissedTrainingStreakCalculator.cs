namespace GymCrm.Application.Attendance;

public sealed class MissedTrainingStreakCalculator
{
    public const int AttentionThreshold = 3;

    public int Calculate(
        IEnumerable<MissedTrainingAttendanceEvent> events,
        MissedTrainingAcknowledgementBoundary? boundary = null)
    {
        ArgumentNullException.ThrowIfNull(events);

        var streak = 0;
        foreach (var attendanceEvent in events
                     .Where(candidate => IsAfterBoundary(candidate, boundary))
                     .OrderBy(candidate => candidate.TrainingDate)
                     .ThenBy(candidate => candidate.TrainingStartTime)
                     .ThenBy(candidate => candidate.AttendanceId))
        {
            streak = attendanceEvent.State switch
            {
                AttendanceState.Absent => streak + 1,
                AttendanceState.Present => 0,
                _ => streak
            };
        }

        return streak;
    }

    private static bool IsAfterBoundary(
        MissedTrainingAttendanceEvent attendanceEvent,
        MissedTrainingAcknowledgementBoundary? boundary)
    {
        if (boundary is null)
        {
            return true;
        }

        // Rows which already existed when the employee contacted the client stay handled even if
        // a group's mutable start time later moves their calculated order past the stored cutoff.
        if (attendanceEvent.MarkedAt <= boundary.AcknowledgedAt)
        {
            return false;
        }

        var dateComparison = attendanceEvent.TrainingDate.CompareTo(boundary.TrainingDate);
        if (dateComparison != 0)
        {
            return dateComparison > 0;
        }

        var timeComparison = attendanceEvent.TrainingStartTime.CompareTo(boundary.TrainingStartTime);
        return timeComparison > 0 ||
               timeComparison == 0 && attendanceEvent.AttendanceId.CompareTo(boundary.AttendanceId) > 0;
    }
}
