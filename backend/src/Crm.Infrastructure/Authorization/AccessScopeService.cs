using Crm.Application.Authorization;
using Crm.Domain.Users;
using Crm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Crm.Infrastructure.Authorization;

internal sealed class AccessScopeService(CrmDbContext dbContext) : IAccessScopeService
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

        return user.Role switch
        {
            UserRole.HeadCoach => new AccessScope(
                user.Role,
                AppSection.Home,
                [
                    AppSection.Home,
                    AppSection.Attendance,
                    AppSection.Clients,
                    AppSection.Groups,
                    AppSection.Users,
                    AppSection.Audit
                ],
                new PermissionSet(
                    CanManageUsers: true,
                    CanManageClients: true,
                    CanManageGroups: true,
                    CanMarkAttendance: true,
                    CanViewAuditLog: true),
                []),
            UserRole.Administrator => new AccessScope(
                user.Role,
                AppSection.Home,
                [
                    AppSection.Home,
                    AppSection.Clients,
                    AppSection.Groups,
                    AppSection.Audit
                ],
                new PermissionSet(
                    CanManageUsers: false,
                    CanManageClients: true,
                    CanManageGroups: true,
                    CanMarkAttendance: false,
                    CanViewAuditLog: true),
                []),
            UserRole.Coach => new AccessScope(
                user.Role,
                AppSection.Attendance,
                [
                    AppSection.Attendance,
                    AppSection.Clients
                ],
                new PermissionSet(
                    CanManageUsers: false,
                    CanManageClients: false,
                    CanManageGroups: false,
                    CanMarkAttendance: true,
                    CanViewAuditLog: false),
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
            UserRole.HeadCoach => GroupAccessDecision.Allowed,
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
