using Crm.Domain.Users;

namespace Crm.Application.Authorization;

public sealed record AccessScope(
    UserRole Role,
    string LandingScreen,
    IReadOnlyList<string> AllowedSections,
    PermissionSet Permissions,
    IReadOnlyList<Guid> AssignedGroupIds);
