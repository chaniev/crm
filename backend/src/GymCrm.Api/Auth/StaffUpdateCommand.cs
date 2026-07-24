using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record StaffUpdateCommand(
    User Actor,
    Guid TargetId,
    UserRole? TargetRoleFilter,
    string? FullName,
    string? Login,
    string? Role,
    bool MustChangePassword,
    bool IsActive,
    string? MessengerPlatform,
    string? MessengerPlatformUserId,
    Guid? BranchId);
