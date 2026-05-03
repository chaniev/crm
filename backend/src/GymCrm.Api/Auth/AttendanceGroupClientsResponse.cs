namespace GymCrm.Api.Auth;

internal sealed record AttendanceGroupClientsResponse(
    Guid GroupId,
    string GroupName,
    DateOnly TrainingDate,
    IReadOnlyList<AttendanceClientResponse> Clients);
