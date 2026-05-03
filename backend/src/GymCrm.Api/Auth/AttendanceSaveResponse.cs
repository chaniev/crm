namespace GymCrm.Api.Auth;

internal sealed record AttendanceSaveResponse(
    Guid GroupId,
    DateOnly TrainingDate,
    IReadOnlyList<AttendanceMarkResponse> AttendanceMarks);
