namespace GymCrm.Api.Auth;

internal sealed record AttendanceSaveResponse(
    Guid GroupId,
    DateOnly TrainingDate,
    DateOnly Today,
    DateOnly MaxTrainingDate,
    IReadOnlyList<AttendanceMarkResponse> AttendanceMarks);
