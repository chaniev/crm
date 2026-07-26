using GymCrm.Application.Authorization;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal static class StaffManagementBoundary
{
    public static StaffAuthorizationDecision AuthorizeRead(User actor, UserRole visibleTargetRole)
    {
        return UserRoleAuthorizationPolicy.CanReadStaff(actor.Role, visibleTargetRole)
            ? StaffAuthorizationDecision.Allow()
            : StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.StaffManagementForbidden);
    }

    public static StaffAuthorizationDecision AuthorizeManagement(User actor)
    {
        return UserRoleAuthorizationPolicy.CanManageStaff(actor.Role)
            ? StaffAuthorizationDecision.Allow()
            : StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.StaffManagementForbidden);
    }

    public static StaffAuthorizationDecision AuthorizeCreate(User actor, UserRole requestedRole)
    {
        return UserRoleAuthorizationPolicy.CanCreateStaff(actor.Role, requestedRole);
    }

    public static StaffAuthorizationDecision AuthorizeUpdate(User actor, User target, UserRole requestedRole)
    {
        return UserRoleAuthorizationPolicy.CanUpdateStaff(
            actor.Role,
            target.Role,
            requestedRole,
            actor.Id == target.Id);
    }

    public static IReadOnlyList<string> GetAllowedActions(User actor, User target)
    {
        return UserRoleAuthorizationPolicy.GetAllowedTargetActions(
                actor.Role,
                target.Role,
                actor.Id == target.Id)
            .Select(action => action.ToString())
            .ToArray();
    }

    public static bool CanManageAttendanceScope(User actor, User target)
    {
        return UserRoleAuthorizationPolicy.GetAllowedTargetActions(
                actor.Role,
                target.Role,
                actor.Id == target.Id)
            .Contains(StaffMutationAction.ManageAttendanceScope);
    }

    public static IReadOnlyList<string> GetCreateRoleOptions(User actor)
    {
        return UserRoleAuthorizationPolicy.GetCreateRoleOptions(actor.Role)
            .Select(role => role.ToString())
            .ToArray();
    }

    public static IReadOnlyList<string> GetCreateRoleOptions(User actor, StaffEndpointRoleFamily endpointRoleFamily)
    {
        return UserRoleAuthorizationPolicy.GetCreateRoleOptions(actor.Role)
            .Where(role => StaffEndpointRoleFamilies.Contains(endpointRoleFamily, role))
            .Select(role => role.ToString())
            .ToArray();
    }

    public static IReadOnlyList<string> GetUpdateRoleOptions(User actor, User target)
    {
        return UserRoleAuthorizationPolicy.GetUpdateRoleOptions(
                actor.Role,
                target.Role,
                actor.Id == target.Id)
            .Select(role => role.ToString())
            .ToArray();
    }

    public static IReadOnlyList<string> GetUpdateRoleOptions(
        User actor,
        User target,
        StaffEndpointRoleFamily endpointRoleFamily,
        bool allowHeadCoachSelfUpdateException = false)
    {
        return UserRoleAuthorizationPolicy.GetUpdateRoleOptions(
                actor.Role,
                target.Role,
                actor.Id == target.Id)
            .Where(role =>
                StaffEndpointRoleFamilies.Contains(endpointRoleFamily, role) ||
                allowHeadCoachSelfUpdateException &&
                StaffEndpointRoleFamilies.CanUseHeadCoachSelfUpdateException(endpointRoleFamily, actor, target) &&
                role == UserRole.HeadCoach)
            .Select(role => role.ToString())
            .ToArray();
    }

    public static StaffAuthorizationDecision AuthorizeEndpointRoleFamily(
        StaffEndpointRoleFamily endpointRoleFamily,
        User actor,
        UserRole requestedRole,
        User? target = null,
        bool allowHeadCoachSelfUpdateException = false)
    {
        if (StaffEndpointRoleFamilies.Contains(endpointRoleFamily, requestedRole))
        {
            return StaffAuthorizationDecision.Allow();
        }

        if (target is not null &&
            allowHeadCoachSelfUpdateException &&
            StaffEndpointRoleFamilies.CanUseHeadCoachSelfUpdateException(endpointRoleFamily, actor, target) &&
            requestedRole == UserRole.HeadCoach)
        {
            return StaffAuthorizationDecision.Allow();
        }

        return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden);
    }

    public static AuditLog CreateAuditLog(
        Guid actorId,
        string action,
        string entityId,
        string description,
        string? oldState,
        string? newState)
    {
        return new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = actorId,
            ActionType = action,
            EntityType = UserAuditConstants.UserEntityType,
            EntityId = entityId,
            Description = description,
            OldValueJson = oldState,
            NewValueJson = newState,
            Source = "Web",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }
}
