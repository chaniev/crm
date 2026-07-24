using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public sealed record AccessScope(
    UserRole Role,
    AccessScopeKind ScopeKind,
    string LandingScreen,
    IReadOnlyList<string> AllowedSections,
    PermissionSet Permissions,
    IReadOnlyList<Guid> AssignedGroupIds);
