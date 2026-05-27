namespace GymCrm.Api.Auth;

internal sealed record GroupTypeAuditState(
    Guid Id,
    string Name,
    string? Description,
    int GroupCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
