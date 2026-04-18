namespace Crm.Application.Authorization;

public sealed record PermissionSet(
    bool CanManageUsers,
    bool CanManageClients,
    bool CanManageGroups,
    bool CanMarkAttendance,
    bool CanViewAuditLog);
