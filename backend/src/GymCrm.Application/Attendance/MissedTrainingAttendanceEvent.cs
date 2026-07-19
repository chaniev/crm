namespace GymCrm.Application.Attendance;

public sealed record MissedTrainingAttendanceEvent(
    Guid AttendanceId,
    DateOnly TrainingDate,
    TimeOnly TrainingStartTime,
    AttendanceState State,
    DateTimeOffset MarkedAt);
