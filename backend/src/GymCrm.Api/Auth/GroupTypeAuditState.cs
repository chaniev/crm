namespace GymCrm.Api.Auth;

internal sealed record GroupTypeAuditState(
    Guid Id,
    string Name,
    string? Description,
    string SystemIdentifier,
    int GroupCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
