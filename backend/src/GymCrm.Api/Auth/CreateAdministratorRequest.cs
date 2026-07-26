namespace GymCrm.Api.Auth;

internal sealed record CreateAdministratorRequest(
    string FullName,
    string Login,
    string Password,
    string Role,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform = null,
    string? MessengerPlatformUserId = null,
    Guid? BranchId = null);
