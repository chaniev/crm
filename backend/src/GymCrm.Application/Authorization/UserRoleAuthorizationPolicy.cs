using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public static class UserRoleAuthorizationPolicy
{
    public static IReadOnlyList<UserRole> GetRolesForCapability(CrmCapability capability)
    {
        return Enum.GetValues<UserRole>()
            .Where(role => HasCapability(role, capability))
            .ToArray();
    }

    public static bool HasCapability(UserRole role, CrmCapability capability)
    {
        var permissions = GetPermissions(role);
        return capability switch
        {
            CrmCapability.ManageUsers => permissions.CanManageUsers,
            CrmCapability.ManageClients => permissions.CanManageClients,
            CrmCapability.ViewClients => role is UserRole.HeadCoach or UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach,
            CrmCapability.ViewClientPhotos => role is UserRole.HeadCoach or UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach,
            CrmCapability.ManageGroups => permissions.CanManageGroups,
            CrmCapability.ManageSettings => permissions.CanManageSettings,
            CrmCapability.ViewAuditLog => permissions.CanViewAuditLog,
            CrmCapability.ViewFinancialReports => permissions.CanViewFinancialReports,
            CrmCapability.MarkAttendance => permissions.CanMarkAttendance,
            CrmCapability.ViewClientMessenger => role is UserRole.HeadCoach or UserRole.SuperAdministrator or UserRole.Administrator,
            CrmCapability.CreateClientMessengerLink => role is UserRole.HeadCoach or UserRole.SuperAdministrator or UserRole.Administrator,
            CrmCapability.ReplyClientMessenger => role is UserRole.HeadCoach or UserRole.SuperAdministrator or UserRole.Administrator,
            _ => false
        };
    }

    public static PermissionSet GetPermissions(UserRole role)
    {
        return role switch
        {
            UserRole.HeadCoach => new PermissionSet(
                CanManageUsers: true,
                CanManageClients: true,
                CanManageGroups: true,
                CanManageSettings: true,
                CanMarkAttendance: true,
                CanViewAuditLog: true,
                CanViewFinancialReports: true),
            UserRole.SuperAdministrator => new PermissionSet(
                CanManageUsers: true,
                CanManageClients: true,
                CanManageGroups: true,
                CanManageSettings: true,
                CanMarkAttendance: true,
                CanViewAuditLog: true,
                CanViewFinancialReports: false),
            UserRole.Administrator => new PermissionSet(
                CanManageUsers: false,
                CanManageClients: true,
                CanManageGroups: true,
                CanManageSettings: true,
                CanMarkAttendance: false,
                CanViewAuditLog: true,
                CanViewFinancialReports: false),
            UserRole.Coach => new PermissionSet(
                CanManageUsers: false,
                CanManageClients: false,
                CanManageGroups: false,
                CanManageSettings: false,
                CanMarkAttendance: true,
                CanViewAuditLog: false,
                CanViewFinancialReports: false),
            _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unsupported user role.")
        };
    }

    public static bool CanBootstrap(UserRole role) => role == UserRole.HeadCoach;

    public static AccessScopeKind GetOperationalScopeKind(UserRole role)
    {
        return role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => AccessScopeKind.Global,
            UserRole.Administrator => AccessScopeKind.Branch,
            UserRole.Coach => AccessScopeKind.AssignedGroups,
            _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unsupported user role.")
        };
    }

    public static bool CanReadStaff(UserRole actorRole, UserRole targetRole)
    {
        return actorRole switch
        {
            UserRole.HeadCoach => true,
            UserRole.SuperAdministrator => true,
            _ => false
        };
    }

    public static IReadOnlyList<UserRole> GetCreateRoleOptions(UserRole actorRole)
    {
        return Enum.GetValues<UserRole>()
            .Where(role => CanCreateStaff(actorRole, role).Allowed)
            .ToArray();
    }

    public static IReadOnlyList<UserRole> GetUpdateRoleOptions(
        UserRole actorRole,
        UserRole currentTargetRole,
        bool isSelfTarget)
    {
        return Enum.GetValues<UserRole>()
            .Where(role => CanUpdateStaff(actorRole, currentTargetRole, role, isSelfTarget).Allowed)
            .ToArray();
    }

    public static StaffAuthorizationDecision CanCreateStaff(UserRole actorRole, UserRole requestedRole)
    {
        if (!CanManageStaff(actorRole))
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.StaffManagementForbidden);
        }

        return actorRole switch
        {
            UserRole.HeadCoach when requestedRole is UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach =>
                StaffAuthorizationDecision.Allow(),
            UserRole.SuperAdministrator when requestedRole is UserRole.Administrator or UserRole.Coach =>
                StaffAuthorizationDecision.Allow(),
            _ => StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden)
        };
    }

    public static StaffAuthorizationDecision CanUpdateStaff(
        UserRole actorRole,
        UserRole currentTargetRole,
        UserRole requestedTargetRole,
        bool isSelfTarget)
    {
        if (!CanManageStaff(actorRole))
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.StaffManagementForbidden);
        }

        if (isSelfTarget)
        {
            if (actorRole == UserRole.HeadCoach &&
                currentTargetRole == UserRole.HeadCoach &&
                requestedTargetRole == UserRole.HeadCoach)
            {
                return StaffAuthorizationDecision.Allow();
            }

            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.SelfMutationForbidden);
        }

        if (actorRole == UserRole.SuperAdministrator &&
            currentTargetRole is UserRole.SuperAdministrator or UserRole.HeadCoach)
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.TargetForbidden);
        }

        if (currentTargetRole == UserRole.SuperAdministrator && requestedTargetRole != UserRole.SuperAdministrator)
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden);
        }

        if (currentTargetRole == UserRole.HeadCoach)
        {
            return actorRole == UserRole.HeadCoach && requestedTargetRole == UserRole.HeadCoach
                ? StaffAuthorizationDecision.Allow()
                : StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.TargetForbidden);
        }

        return actorRole switch
        {
            UserRole.HeadCoach when requestedTargetRole is UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach =>
                StaffAuthorizationDecision.Allow(),
            UserRole.SuperAdministrator when currentTargetRole is UserRole.Administrator or UserRole.Coach &&
                requestedTargetRole == currentTargetRole =>
                StaffAuthorizationDecision.Allow(),
            _ => StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden)
        };
    }

    public static IReadOnlyList<StaffMutationAction> GetAllowedTargetActions(
        UserRole actorRole,
        UserRole targetRole,
        bool isSelfTarget)
    {
        if (isSelfTarget || !CanManageStaff(actorRole))
        {
            return [];
        }

        if (actorRole == UserRole.HeadCoach)
        {
            return targetRole == UserRole.HeadCoach
                ? [StaffMutationAction.Edit]
                : [StaffMutationAction.Edit, StaffMutationAction.Deactivate, StaffMutationAction.Reactivate];
        }

        return actorRole == UserRole.SuperAdministrator && targetRole is UserRole.Administrator or UserRole.Coach
            ? [StaffMutationAction.Edit, StaffMutationAction.Deactivate, StaffMutationAction.Reactivate]
            : [];
    }

    public static bool CanManageStaff(UserRole actorRole)
    {
        return actorRole is UserRole.HeadCoach or UserRole.SuperAdministrator;
    }
}
