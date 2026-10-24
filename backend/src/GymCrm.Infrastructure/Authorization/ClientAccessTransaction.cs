using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Infrastructure.Authorization;

public static class ClientAccessTransaction
{
    public static async Task<IDbContextTransaction?> BeginReadAsync(
        GymCrmDbContext dbContext,
        Guid actorId,
        IReadOnlyCollection<Guid> clientIds,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            return null;
        }

        var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (dbContext.Database.IsNpgsql())
            {
                await dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"""SELECT 1 FROM "Users" WHERE "Id" = {actorId} FOR SHARE""", cancellationToken);
                foreach (var clientId in clientIds.Distinct().Order())
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR SHARE""", cancellationToken);
                }
            }
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    // The actor lease is acquired first; all client rows are then locked in one stable order.
    public static async Task LockReadClientsAsync(GymCrmDbContext dbContext, IReadOnlyCollection<Guid> clientIds, CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory" || !dbContext.Database.IsNpgsql()) return;
        foreach (var clientId in clientIds.Distinct().Order())
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR SHARE""", cancellationToken);
    }

    public static Task<IDbContextTransaction?> BeginMutationAsync(
        GymCrmDbContext dbContext,
        Guid actorId,
        Guid? clientId,
        IReadOnlyCollection<Guid> requestedGroupIds,
        IReadOnlyCollection<Guid> requestedBranchIds,
        CancellationToken cancellationToken) => BeginMutationForClientsAsync(dbContext, actorId,
            clientId.HasValue ? [clientId.Value] : [], requestedGroupIds, requestedBranchIds, [], cancellationToken);

    public static async Task<IDbContextTransaction?> BeginMutationForClientsAsync(
        GymCrmDbContext dbContext,
        Guid actorId,
        IReadOnlyCollection<Guid> clientIds,
        IReadOnlyCollection<Guid> requestedGroupIds,
        IReadOnlyCollection<Guid> requestedBranchIds,
        IReadOnlyCollection<Guid> attendanceGrantGroupIds,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            return null;
        }

        for (var attempt = 0; attempt < 3; attempt++)
        {
            var preparedGroups = await DiscoverGroupIdsAsync(dbContext, clientIds, requestedGroupIds, cancellationToken);
            var preparedBranches = await DiscoverBranchIdsAsync(dbContext, actorId, clientIds, preparedGroups, requestedBranchIds, cancellationToken);
            var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                if (dbContext.Database.IsNpgsql())
                {
                    foreach (var branchId in preparedBranches)
                    {
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"""SELECT 1 FROM "Branches" WHERE "Id" = {branchId} FOR SHARE""", cancellationToken);
                    }
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"""SELECT 1 FROM "Users" WHERE "Id" = {actorId} FOR SHARE""", cancellationToken);
                    foreach (var groupId in preparedGroups)
                    {
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""", cancellationToken);
                    }
                    foreach (var groupId in attendanceGrantGroupIds.Distinct().Order())
                    {
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"""SELECT 1 FROM "AdministratorAttendanceGroupGrants" WHERE "AdministratorId" = {actorId} AND "GroupId" = {groupId} FOR UPDATE""", cancellationToken);
                    }
                    foreach (var clientId in clientIds.Distinct().Order())
                    {
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR UPDATE""", cancellationToken);
                    }
                }

                var currentGroups = await DiscoverGroupIdsAsync(dbContext, clientIds, requestedGroupIds, cancellationToken);
                var currentBranches = await DiscoverBranchIdsAsync(dbContext, actorId, clientIds, currentGroups, requestedBranchIds, cancellationToken);
                if (preparedGroups.SequenceEqual(currentGroups) && preparedBranches.SequenceEqual(currentBranches))
                {
                    return transaction;
                }
                await transaction.RollbackAsync(cancellationToken);
                await transaction.DisposeAsync();
            }
            catch
            {
                await transaction.DisposeAsync();
                throw;
            }
        }

        throw new DbUpdateConcurrencyException("Client authorization lock preparation changed repeatedly.");
    }

    public static Task<User?> LoadActorAsync(GymCrmDbContext dbContext, Guid actorId, CancellationToken cancellationToken) =>
        dbContext.Users.AsNoTracking().SingleOrDefaultAsync(user => user.Id == actorId && user.IsActive, cancellationToken);

    public static Task<bool> CanAccessAsync(GymCrmDbContext dbContext, User actor, Guid clientId, CancellationToken cancellationToken) =>
        dbContext.Clients.Where(ClientAccessPolicy.ScopePredicate(actor)).AnyAsync(client => client.Id == clientId, cancellationToken);

    private static async Task<Guid[]> DiscoverGroupIdsAsync(
        GymCrmDbContext dbContext, IReadOnlyCollection<Guid> clientIds, IReadOnlyCollection<Guid> requestedGroupIds, CancellationToken cancellationToken)
    {
        var assigned = await dbContext.ClientGroups.AsNoTracking()
            .Where(group => clientIds.Contains(group.ClientId)).Select(group => group.GroupId).ToArrayAsync(cancellationToken);
        var targets = await dbContext.ClientMemberships.AsNoTracking()
            .Where(membership => clientIds.Contains(membership.ClientId))
            .SelectMany(membership => membership.TargetGroups.Select(target => target.GroupId)).ToArrayAsync(cancellationToken);
        return requestedGroupIds.Concat(assigned).Concat(targets).Distinct().Order().ToArray();
    }

    private static async Task<Guid[]> DiscoverBranchIdsAsync(
        GymCrmDbContext dbContext, Guid actorId, IReadOnlyCollection<Guid> clientIds, IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> requestedBranchIds, CancellationToken cancellationToken)
    {
        var actorBranch = await dbContext.Users.AsNoTracking().Where(user => user.Id == actorId)
            .Select(user => user.BranchId).SingleOrDefaultAsync(cancellationToken);
        var clientBranches = await dbContext.Clients.AsNoTracking().Where(client => clientIds.Contains(client.Id))
            .Select(client => client.BranchId).ToArrayAsync(cancellationToken);
        var groupBranches = await dbContext.TrainingGroups.AsNoTracking().Where(group => groupIds.Contains(group.Id))
            .Select(group => group.BranchId).ToArrayAsync(cancellationToken);
        var targetBranches = await dbContext.ClientMemberships.AsNoTracking().Where(membership => clientIds.Contains(membership.ClientId))
            .SelectMany(membership => membership.TargetGroups.Select(target => target.BranchId)).ToArrayAsync(cancellationToken);
        return requestedBranchIds.Concat(groupBranches).Concat(targetBranches)
            .Concat(clientBranches).Concat(new[] { actorBranch }.OfType<Guid>()).Distinct().Order().ToArray();
    }
}
