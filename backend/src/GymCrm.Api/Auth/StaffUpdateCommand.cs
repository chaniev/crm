using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record StaffUpdateCommand(
    User Actor,
    Guid TargetId,
    StaffEndpointRoleFamily EndpointRoleFamily,
    bool AllowHeadCoachSelfUpdateException,
    string? FullName,
    string? Login,
    string? Role,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform,
    string? MessengerPlatformUserId,
    Guid? BranchId);
