namespace GymCrm.Api.Auth;

internal sealed record AttendanceTodayLessonsResponse(
    DateOnly Today,
    IReadOnlyList<AttendanceTodayLessonResponse> Items);
