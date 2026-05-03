namespace GymCrm.Api.Auth;

internal sealed record ClientAttendanceHistoryEntryResponse(
    Guid Id,
    DateOnly TrainingDate,
    bool IsPresent,
    Guid GroupId,
    string GroupName,
    string? GroupTrainingStartTime,
    string? GroupScheduleText);
