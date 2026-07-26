using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record StaffCreateCommand(
    User Actor,
    string? FullName,
    string? Login,
    string? Password,
    string? Role,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform,
    string? MessengerPlatformUserId,
    Guid? BranchId,
    StaffEndpointRoleFamily EndpointRoleFamily);
