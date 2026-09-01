namespace GymCrm.Api.Auth;

internal sealed record AttendanceTodayLessonResponse(
    Guid LessonOccurrenceId,
    DateOnly LessonDate,
    Guid GroupId,
    string GroupName,
    string StartTime,
    string EndTime,
    string BranchName,
    string HallName,
    IReadOnlyList<AttendanceTodayTrainerResponse> EffectiveTrainers,
    ScheduleActionResponse OpenAttendance,
    int UnmarkedClientCount);
