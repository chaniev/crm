namespace GymCrm.Api.Auth;

internal sealed record AttendanceAuditState(
    Guid ClientId,
    Guid GroupId,
    DateOnly TrainingDate,
    bool IsPresent);
