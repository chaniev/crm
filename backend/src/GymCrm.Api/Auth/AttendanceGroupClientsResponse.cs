namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupClientsResponse(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    DateOnly Today,
    DateOnly? MinTrainingDate,
    DateOnly MaxTrainingDate,
    IReadOnlyList<AttendanceClientResponse> Clients);
