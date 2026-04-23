namespace GymCrm.Api.Auth;

internal sealed record UserAuditState(
    Guid Id,
    string FullName,
    string Login,
    string Role,
    bool MustChangeCredentials,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
