namespace GymCrm.Api.Auth;

internal sealed record UpdateAdministratorRequest(
    string FullName,
    string Login,
    string Role,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform = null,
    string? MessengerPlatformUserId = null,
    Guid? BranchId = null);
