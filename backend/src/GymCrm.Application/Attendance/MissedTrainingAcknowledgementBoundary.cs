namespace GymCrm.Application.Attendance;

public sealed record MissedTrainingAcknowledgementBoundary(
    Guid AttendanceId,
    DateOnly TrainingDate,
    TimeOnly TrainingStartTime,
    DateTimeOffset AcknowledgedAt);
