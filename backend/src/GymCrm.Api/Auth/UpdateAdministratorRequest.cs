namespace GymCrm.Api.Auth;

internal sealed record UpdateAdministratorRequest(
    string FullName,
    string Login,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform = null,
    string? MessengerPlatformUserId = null);
