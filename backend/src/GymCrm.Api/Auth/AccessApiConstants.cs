namespace GymCrm.Api.Auth;

internal static class AccessApiConstants
{
    public const string RoutePrefix = "/access";
    public const string UserManagementRoute = "/user-management";
    public const string ClientManagementRoute = "/client-management";
    public const string GroupManagementRoute = "/group-management";
    public const string SettingsManagementRoute = "/settings-management";
    public const string AuditLogRoute = "/audit-log";
    public const string FinancialReportsRoute = "/financial-reports";
    public const string AttendanceRoute = "/attendance/{groupId:guid}";

    public const string UserManagementCapability = "UserManagement";
    public const string ClientManagementCapability = "ClientManagement";
    public const string GroupManagementCapability = "GroupManagement";
    public const string SettingsManagementCapability = "SettingsManagement";
    public const string AuditLogCapability = "AuditLog";
    public const string FinancialReportsCapability = "FinancialReports";
    public const string AttendanceCapability = "Attendance";

    public const string CoachGroupAssignmentGrantedBy = "coach-group-assignment";
    public const string AdministratorAttendanceGrantGrantedBy = "administrator-attendance-grant";
}
