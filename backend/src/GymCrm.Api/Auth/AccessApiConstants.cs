namespace GymCrm.Api.Auth;

internal static class AccessApiConstants
{
    public const string RoutePrefix = "/access";
    public const string UserManagementRoute = "/user-management";
    public const string ClientManagementRoute = "/client-management";
    public const string GroupManagementRoute = "/group-management";
    public const string AuditLogRoute = "/audit-log";
    public const string AttendanceRoute = "/attendance/{groupId:guid}";

    public const string UserManagementCapability = "UserManagement";
    public const string ClientManagementCapability = "ClientManagement";
    public const string GroupManagementCapability = "GroupManagement";
    public const string AuditLogCapability = "AuditLog";
    public const string AttendanceCapability = "Attendance";

    public const string AssignedCoachScopeGrantedBy = "AssignedCoachScope";
}
