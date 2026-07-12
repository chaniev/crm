namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupClientsResponse(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    DateOnly Today,
    DateOnly MaxTrainingDate,
    IReadOnlyList<AttendanceClientResponse> Clients);
