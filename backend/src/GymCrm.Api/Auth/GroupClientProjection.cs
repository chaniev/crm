namespace GymCrm.Api.Auth;

internal sealed record GroupClientProjection(
    Guid Id,
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string Status);
