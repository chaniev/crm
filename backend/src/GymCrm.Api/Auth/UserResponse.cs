namespace GymCrm.Api.Auth;

internal sealed record UserResponse(
    Guid Id,
    string FullName,
    string Login,
    string Role,
    bool MustChangePassword,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
