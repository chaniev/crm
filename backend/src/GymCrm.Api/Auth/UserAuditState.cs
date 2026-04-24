namespace GymCrm.Api.Auth;

internal sealed record UserAuditState(
    Guid Id,
    string FullName,
    string Login,
    string Role,
    string? MessengerPlatform,
    string? MessengerPlatformUserId,
    bool MustChangeCredentials,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
