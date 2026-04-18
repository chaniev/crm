using Crm.Domain.Users;

namespace Crm.Application.Authorization;

public static class AppSection
{
    public const string Home = "Home";
    public const string Attendance = "Attendance";
    public const string Clients = "Clients";
    public const string Groups = "Groups";
    public const string Users = "Users";
    public const string Audit = "Audit";
}

public sealed record PermissionSet(
    bool CanManageUsers,
    bool CanManageClients,
    bool CanManageGroups,
    bool CanMarkAttendance,
    bool CanViewAuditLog);

public sealed record AccessScope(
    UserRole Role,
    string LandingScreen,
    IReadOnlyList<string> AllowedSections,
    PermissionSet Permissions,
    IReadOnlyList<Guid> AssignedGroupIds);

public enum GroupAccessDecision
{
    Allowed = 1,
    Forbidden = 2,
    GroupNotFound = 3
}
