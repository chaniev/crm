namespace GymCrm.Api.Auth;

internal sealed record CreateAdministratorRequest(
    string FullName,
    string Login,
    string Password,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform = null,
    string? MessengerPlatformUserId = null,
    Guid BranchId = default);
