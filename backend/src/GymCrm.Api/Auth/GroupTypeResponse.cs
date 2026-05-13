namespace GymCrm.Api.Auth;

internal sealed record GroupTypeResponse(
    Guid Id,
    string Name,
    string? Description,
    string SystemIdentifier,
    int GroupCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
