namespace GymCrm.Application.Authorization;

public sealed record PermissionSet(
    bool CanManageUsers,
    bool CanManageClients,
    bool CanManageGroups,
    bool CanManageSettings,
    bool CanMarkAttendance,
    bool CanViewAuditLog,
    bool CanViewFinancialReports);
