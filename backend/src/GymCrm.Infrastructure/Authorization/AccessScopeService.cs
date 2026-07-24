using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Authorization;

internal sealed class AccessScopeService(GymCrmDbContext dbContext) : IAccessScopeService
{
    public async Task<AccessScope> GetAccessScopeAsync(User user, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);

        var assignedGroupIds = user.Role == UserRole.Coach
            ? await dbContext.GroupTrainers
                .Where(groupTrainer => groupTrainer.TrainerId == user.Id)
                .OrderBy(groupTrainer => groupTrainer.GroupId)
                .Select(groupTrainer => groupTrainer.GroupId)
                .ToArrayAsync(cancellationToken)
            : [];

        var permissions = UserRoleAuthorizationPolicy.GetPermissions(user.Role);
        var scopeKind = UserRoleAuthorizationPolicy.GetOperationalScopeKind(user.Role);

        return user.Role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => new AccessScope(
                user.Role,
                scopeKind,
                AppSection.Home,
                [
                    AppSection.Home,
                    AppSection.Clients,
                    AppSection.Groups,
                    AppSection.Users,
                    AppSection.Audit,
                    .. (user.Role == UserRole.HeadCoach ? [AppSection.Finance] : Array.Empty<string>()),
                    AppSection.Settings
                ],
                permissions,
                []),
            UserRole.Administrator => new AccessScope(
                user.Role,
                scopeKind,
                AppSection.Home,
                [
                    AppSection.Home,
                    AppSection.Clients,
                    AppSection.Groups,
                    AppSection.Audit,
                    AppSection.Settings
                ],
                permissions,
                []),
            UserRole.Coach => new AccessScope(
                user.Role,
                scopeKind,
                AppSection.Home,
                [
                    AppSection.Home,
                    AppSection.Clients
                ],
                permissions,
                assignedGroupIds),
            _ => throw new InvalidOperationException($"Unsupported user role '{user.Role}'.")
        };
    }

    public async Task<GroupAccessDecision> EvaluateGroupAccessAsync(
        User user,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);

        var groupExists = await dbContext.TrainingGroups
            .AnyAsync(group => group.Id == groupId, cancellationToken);

        if (!groupExists)
        {
            return GroupAccessDecision.GroupNotFound;
        }

        return user.Role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => GroupAccessDecision.Allowed,
            UserRole.Coach => await dbContext.GroupTrainers
                .AnyAsync(
                    groupTrainer =>
                        groupTrainer.GroupId == groupId &&
                        groupTrainer.TrainerId == user.Id,
                    cancellationToken)
                ? GroupAccessDecision.Allowed
                : GroupAccessDecision.Forbidden,
            _ => GroupAccessDecision.Forbidden
        };
    }
}
