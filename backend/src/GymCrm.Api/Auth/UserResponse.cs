namespace GymCrm.Api.Auth;

internal sealed record UserResponse(
    Guid Id,
    string FullName,
    string Login,
    string Role,
    string? MessengerPlatform,
    string? MessengerPlatformUserId,
    bool MustChangePassword,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Guid? BranchId = null,
    string? BranchName = null,
    IReadOnlyList<string>? AllowedActions = null,
    IReadOnlyList<string>? RoleOptions = null);
