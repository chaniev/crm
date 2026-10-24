using System.Linq.Expressions;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public static class ClientAccessPolicy
{
    public static Expression<Func<Client, bool>> ScopePredicate(
        User actor,
        IReadOnlyCollection<Guid>? effectiveGroupIds = null)
    {
        if (!actor.IsActive)
        {
            return _ => false;
        }

        var branchId = actor.BranchId;
        return UserRoleAuthorizationPolicy.GetOperationalScopeKind(actor.Role) switch
        {
            AccessScopeKind.Global => _ => true,
            AccessScopeKind.Branch => client => branchId.HasValue && branchId != Guid.Empty && client.BranchId == branchId,
            AccessScopeKind.AssignedGroups when effectiveGroupIds is not null =>
                client => client.Groups.Any(group => effectiveGroupIds.Contains(group.GroupId)),
            _ => _ => false
        };
    }

    // Additional restriction for projections whose outer group/occurrence contract already scopes coaches.
    public static Expression<Func<Client, bool>> BranchRestriction(User actor) =>
        UserRoleAuthorizationPolicy.GetOperationalScopeKind(actor.Role) == AccessScopeKind.Branch
            ? ScopePredicate(actor)
            : client => actor.IsActive;

    public static bool CanAccessBranch(User actor, Guid? branchId)
    {
        return actor.IsActive && UserRoleAuthorizationPolicy.GetOperationalScopeKind(actor.Role) switch
        {
            AccessScopeKind.Global => true,
            AccessScopeKind.Branch => actor.BranchId.HasValue && actor.BranchId != Guid.Empty && actor.BranchId == branchId,
            _ => false
        };
    }
}
