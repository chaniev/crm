using System.Text.Json;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Authorization;

internal sealed class AdministratorAttendanceGroupGrantService(GymCrmDbContext dbContext) : IAdministratorAttendanceGroupGrantService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<AdministratorAttendanceGroupGrantServiceResult> GetAsync(
        Guid administratorId,
        User currentUser,
        CancellationToken cancellationToken)
    {
        var target = await dbContext.Users
            .AsNoTracking()
            .Include(user => user.Branch)
            .SingleOrDefaultAsync(
                user => user.Id == administratorId && user.Role == UserRole.Administrator,
                cancellationToken);
        if (target is null)
        {
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.NotFound);
        }

        if (!CanManageAttendanceScope(currentUser, target))
        {
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.Forbidden);
        }

        return AdministratorAttendanceGroupGrantServiceResult.Success(await BuildResponseAsync(target, cancellationToken));
    }

    public async Task<AdministratorAttendanceGroupGrantServiceResult> UpdateAsync(
        Guid administratorId,
        User currentUser,
        IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> expectedGroupIds,
        CancellationToken cancellationToken)
    {
        var target = await dbContext.Users
            .Include(user => user.Branch)
            .SingleOrDefaultAsync(
                user => user.Id == administratorId && user.Role == UserRole.Administrator,
                cancellationToken);
        if (target is null)
        {
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.NotFound);
        }

        if (!CanManageAttendanceScope(currentUser, target))
        {
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.Forbidden);
        }

        var referencedIds = groupIds.Concat(expectedGroupIds).Distinct().Order().ToArray();
        var referencedGroupsForLocks = referencedIds.Length == 0
            ? []
            : await dbContext.TrainingGroups
                .AsNoTracking()
                .Where(group => referencedIds.Contains(group.Id))
                .Select(group => new LockedGroup(group.Id, group.BranchId))
                .ToArrayAsync(cancellationToken);

        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var supportsTransactions = !providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase);
        await using var transaction = supportsTransactions
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var discoveredCurrentGrants = await dbContext.AdministratorAttendanceGroupGrants
            .AsNoTracking()
            .Where(grant => grant.AdministratorId == administratorId)
            .OrderBy(grant => grant.GroupId)
            .Select(grant => new LockedGroup(grant.GroupId, grant.BranchId))
            .ToArrayAsync(cancellationToken);

        await LockGrantMutationRowsAsync(
            currentUser.Id,
            administratorId,
            new[] { target.BranchId }
                .Where(branchId => branchId.HasValue)
                .Select(branchId => branchId!.Value)
                .Concat(referencedGroupsForLocks.Select(group => group.BranchId))
                .Concat(discoveredCurrentGrants.Select(grant => grant.BranchId))
                .Distinct()
                .Order()
                .ToArray(),
            referencedGroupsForLocks.Select(group => group.Id)
                .Concat(discoveredCurrentGrants.Select(grant => grant.Id))
                .Distinct()
                .Order()
                .ToArray(),
            cancellationToken);

        var lockedActor = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Id == currentUser.Id, cancellationToken);
        if (lockedActor is null || !lockedActor.IsActive)
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.Forbidden);
        }

        target = await dbContext.Users
            .AsNoTracking()
            .Include(user => user.Branch)
            .SingleOrDefaultAsync(user => user.Id == administratorId, cancellationToken);
        if (target is null || target.Role != UserRole.Administrator)
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.NotFound);
        }

        if (!CanManageAttendanceScope(lockedActor, target))
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.Forbidden);
        }

        var knownIds = referencedIds.Length == 0
            ? []
            : await dbContext.TrainingGroups
                .Where(group => referencedIds.Contains(group.Id))
                .Select(group => group.Id)
                .ToArrayAsync(cancellationToken);
        var validationErrors = CreateUnknownGroupValidationErrors(groupIds, expectedGroupIds, knownIds);
        if (validationErrors.Count > 0)
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Validation(validationErrors);
        }

        var currentSet = await dbContext.AdministratorAttendanceGroupGrants
            .Where(grant => grant.AdministratorId == administratorId)
            .OrderBy(grant => grant.GroupId)
            .Select(grant => grant.GroupId)
            .ToArrayAsync(cancellationToken);

        if (SetEquals(currentSet, groupIds))
        {
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return AdministratorAttendanceGroupGrantServiceResult.Success(await BuildResponseAsync(target, cancellationToken));
        }

        if (!SetEquals(currentSet, expectedGroupIds))
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.ConcurrencyConflict);
        }

        var desiredAdditions = groupIds.Except(currentSet).Order().ToArray();
        if (desiredAdditions.Length > 0 && (!target.IsActive || target.Branch is null || target.Branch.IsArchived))
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.InactiveResource);
        }

        var additionGroups = desiredAdditions.Length == 0
            ? []
            : await dbContext.TrainingGroups
                .Include(group => group.Branch)
                .Where(group => desiredAdditions.Contains(group.Id))
                .ToArrayAsync(cancellationToken);

        if (additionGroups.Any(group => group.BranchId != target.BranchId))
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.BranchForbidden);
        }

        if (additionGroups.Any(group => !group.IsActive || group.Branch.IsArchived))
        {
            await RollbackAsync(transaction, cancellationToken);
            return AdministratorAttendanceGroupGrantServiceResult.Failure(AdministratorAttendanceGroupGrantServiceError.InactiveResource);
        }

        var now = DateTimeOffset.UtcNow;
        var removals = currentSet.Except(groupIds).Order().ToArray();
        foreach (var groupId in removals)
        {
            var grant = await dbContext.AdministratorAttendanceGroupGrants
                .SingleAsync(
                    candidate => candidate.AdministratorId == administratorId && candidate.GroupId == groupId,
                    cancellationToken);
            dbContext.AdministratorAttendanceGroupGrants.Remove(grant);
            dbContext.AuditLogs.Add(CreateAudit(
                lockedActor.Id,
                "AdministratorAttendanceGroupRevoked",
                administratorId,
                groupId,
                grant.BranchId,
                grant.GrantedByUserId,
                grant.GrantedAt,
                oldState: true,
                now));
        }

        foreach (var group in additionGroups.OrderBy(group => group.Id))
        {
            var grant = new AdministratorAttendanceGroupGrant
            {
                AdministratorId = administratorId,
                GroupId = group.Id,
                BranchId = group.BranchId,
                GrantedByUserId = lockedActor.Id,
                GrantedAt = now
            };
            dbContext.AdministratorAttendanceGroupGrants.Add(grant);
            dbContext.AuditLogs.Add(CreateAudit(
                lockedActor.Id,
                "AdministratorAttendanceGroupGranted",
                administratorId,
                group.Id,
                group.BranchId,
                lockedActor.Id,
                now,
                oldState: false,
                now));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return AdministratorAttendanceGroupGrantServiceResult.Success(await BuildResponseAsync(target, cancellationToken));
    }

    private async Task LockGrantMutationRowsAsync(
        Guid actorId,
        Guid administratorId,
        IReadOnlyList<Guid> involvedBranchIds,
        IReadOnlyList<Guid> involvedGroupIds,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        foreach (var branchId in involvedBranchIds.Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Branches" WHERE "Id" = {branchId} FOR UPDATE""",
                cancellationToken);
        }

        foreach (var userId in new[] { actorId, administratorId }.Distinct().Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Users" WHERE "Id" = {userId} FOR UPDATE""",
                cancellationToken);
        }

        foreach (var groupId in involvedGroupIds.Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
                cancellationToken);
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "AdministratorAttendanceGroupGrants" WHERE "AdministratorId" = {administratorId} ORDER BY "AdministratorId", "GroupId" FOR UPDATE""",
            cancellationToken);
    }

    private async Task<AdministratorAttendanceGroupsResponse> BuildResponseAsync(
        User target,
        CancellationToken cancellationToken)
    {
        var storedGrants = await dbContext.AdministratorAttendanceGroupGrants
            .AsNoTracking()
            .Where(grant => grant.AdministratorId == target.Id)
            .OrderBy(grant => grant.GroupId)
            .ToArrayAsync(cancellationToken);
        var storedGroupIds = storedGrants.Select(grant => grant.GroupId).ToHashSet();
        var branchArchived = target.Branch?.IsArchived ?? true;

        var groups = target.BranchId.HasValue
            ? await dbContext.TrainingGroups
                .AsNoTracking()
                .Where(group => group.BranchId == target.BranchId.Value)
                .OrderBy(group => group.IsActive ? 0 : 1)
                .ThenBy(group => group.Name)
                .ThenBy(group => group.TrainingStartTime)
                .ThenBy(group => group.Id)
                .Select(group => new AdministratorAttendanceGroupOptionResponse(
                    group.Id,
                    group.Name,
                    group.TrainingStartTime.ToString("HH\\:mm"),
                    group.DurationMinutes,
                    group.Weekdays,
                    group.IsActive,
                    storedGroupIds.Contains(group.Id),
                    target.IsActive && !branchArchived && group.IsActive,
                    storedGroupIds.Contains(group.Id),
                    ResolveDisabledReason(target.IsActive, branchArchived, group.IsActive, storedGroupIds.Contains(group.Id))))
                .ToArrayAsync(cancellationToken)
            : [];

        var visibleGroupIds = groups.Select(group => group.Id).ToHashSet();
        var unavailable = storedGrants
            .Where(grant => !visibleGroupIds.Contains(grant.GroupId) || grant.BranchId != target.BranchId)
            .Select(grant => new AdministratorAttendanceUnavailableGrantResponse(
                grant.GroupId,
                grant.BranchId,
                true,
                false,
                true,
                "grant_scope_invalid"))
            .ToArray();

        return new AdministratorAttendanceGroupsResponse(
            new AdministratorAttendanceTargetResponse(
                target.Id,
                target.FullName,
                target.Login,
                target.IsActive),
            target.Branch is null
                ? null
                : new AdministratorAttendanceBranchResponse(target.Branch.Id, target.Branch.Name, target.Branch.IsArchived),
            storedGrants.Select(grant => grant.GroupId).Order().ToArray(),
            storedGrants.Length,
            groups,
            unavailable);
    }

    private static Dictionary<string, string[]> CreateUnknownGroupValidationErrors(
        IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> expectedGroupIds,
        IReadOnlyCollection<Guid> knownIds)
    {
        var unknownDesiredIds = groupIds.Except(knownIds).Order().ToArray();
        var unknownExpectedIds = expectedGroupIds.Except(knownIds).Order().ToArray();
        var errors = new Dictionary<string, string[]>();
        if (unknownDesiredIds.Length > 0)
        {
            errors["groupIds"] = [global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AdministratorAttendanceGroupGrantServiceLine350D50fc303];
        }

        if (unknownExpectedIds.Length > 0)
        {
            errors["expectedGroupIds"] = [global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AdministratorAttendanceGroupGrantServiceLine355D50fc303];
        }

        return errors;
    }

    private static bool SetEquals(IReadOnlyCollection<Guid> left, IReadOnlyCollection<Guid> right)
    {
        return left.Count == right.Count && left.Order().SequenceEqual(right.Order());
    }

    private static bool CanManageAttendanceScope(User actor, User target)
    {
        return UserRoleAuthorizationPolicy.GetAllowedTargetActions(
                actor.Role,
                target.Role,
                actor.Id == target.Id)
            .Contains(StaffMutationAction.ManageAttendanceScope);
    }

    private static string? ResolveDisabledReason(bool targetActive, bool branchArchived, bool groupActive, bool isGranted)
    {
        if (isGranted)
        {
            return null;
        }

        if (!targetActive)
        {
            return "inactive_administrator";
        }

        if (branchArchived)
        {
            return "archived_branch";
        }

        return groupActive ? null : "inactive_group";
    }

    private static AuditLog CreateAudit(
        Guid actorId,
        string action,
        Guid administratorId,
        Guid groupId,
        Guid branchId,
        Guid grantedByUserId,
        DateTimeOffset grantedAt,
        bool oldState,
        DateTimeOffset createdAt)
    {
        var state = JsonSerializer.Serialize(new
        {
            AdministratorId = administratorId,
            GroupId = groupId,
            BranchId = branchId,
            GrantedByUserId = grantedByUserId,
            GrantedAt = grantedAt
        }, SerializerOptions);

        return new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = actorId,
            ActionType = action,
            EntityType = "AdministratorAttendanceGroupGrant",
            EntityId = $"{administratorId}:{groupId}",
            Description = action == "AdministratorAttendanceGroupGranted"
                ? "Administrator attendance group grant was added."
                : "Administrator attendance group grant was revoked.",
            OldValueJson = oldState ? state : null,
            NewValueJson = oldState ? null : state,
            Source = "Web",
            CreatedAt = createdAt
        };
    }

    private static async Task RollbackAsync(
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }

    private sealed record LockedGroup(Guid Id, Guid BranchId);
}
