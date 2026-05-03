namespace GymCrm.Api.Auth;

internal sealed record SaveAttendanceRequest(
    string? TrainingDate,
    IReadOnlyList<AttendanceMarkRequest>? AttendanceMarks);
