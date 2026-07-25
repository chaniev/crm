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

        var coachAssignedGroupIds = user.Role == UserRole.Coach
            ? await dbContext.GroupTrainers
                .Where(groupTrainer => groupTrainer.TrainerId == user.Id)
                .OrderBy(groupTrainer => groupTrainer.GroupId)
                .Select(groupTrainer => groupTrainer.GroupId)
                .ToArrayAsync(cancellationToken)
            : [];
        var administratorGrantedGroupIds = user.Role == UserRole.Administrator
            ? await dbContext.AdministratorAttendanceGroupGrants
                .Where(grant =>
                    grant.AdministratorId == user.Id &&
                    grant.Administrator.Role == UserRole.Administrator &&
                    grant.Administrator.IsActive &&
                    grant.Administrator.BranchId == grant.BranchId &&
                    !grant.Branch.IsArchived &&
                    grant.Group.BranchId == grant.BranchId)
                .OrderBy(grant => grant.GroupId)
                .Select(grant => grant.GroupId)
                .ToArrayAsync(cancellationToken)
            : [];

        var permissions = UserRoleAuthorizationPolicy.GetPermissions(user.Role);
        var scopeKind = UserRoleAuthorizationPolicy.GetOperationalScopeKind(user.Role);
        var attendanceScope = user.Role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => new AttendanceScope(AttendanceScopeKind.Global, []),
            UserRole.Coach => new AttendanceScope(AttendanceScopeKind.TrainerAssignments, coachAssignedGroupIds),
            UserRole.Administrator => new AttendanceScope(AttendanceScopeKind.AdministratorGrants, administratorGrantedGroupIds),
            _ => throw new InvalidOperationException($"Unsupported user role '{user.Role}'.")
        };

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
                attendanceScope,
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
                attendanceScope,
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
                attendanceScope,
                coachAssignedGroupIds),
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
            UserRole.Administrator => await dbContext.AdministratorAttendanceGroupGrants
                .AnyAsync(
                    grant =>
                        grant.GroupId == groupId &&
                        grant.AdministratorId == user.Id &&
                        grant.Administrator.Role == UserRole.Administrator &&
                        grant.Administrator.IsActive &&
                        grant.Administrator.BranchId == grant.BranchId &&
                        !grant.Branch.IsArchived &&
                        grant.Group.BranchId == grant.BranchId,
                    cancellationToken)
                ? GroupAccessDecision.Allowed
                : GroupAccessDecision.Forbidden,
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
