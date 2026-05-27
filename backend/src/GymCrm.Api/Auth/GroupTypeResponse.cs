namespace GymCrm.Api.Auth;

internal sealed record GroupTypeResponse(
    Guid Id,
    string Name,
    string? Description,
    int GroupCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
