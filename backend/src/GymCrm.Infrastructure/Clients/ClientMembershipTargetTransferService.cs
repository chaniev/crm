using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipTargetTransferService(
    GymCrmDbContext dbContext,
    IBusinessDateProvider businessDateProvider,
    TimeProvider timeProvider) : IClientMembershipTargetTransferService
{
    public async Task<ClientMembershipTargetTransferResult> PreviewAsync(
        Guid clientId,
        ClientMembershipTargetTransferCommand command,
        CancellationToken cancellationToken)
    {
        return await BuildPreviewAsync(
            clientId,
            command,
            tracking: false,
            requireExpectedMemberships: false,
            cancellationToken);
    }

    public async Task<ClientMembershipTargetTransferResult> TransferAsync(
        Guid clientId,
        ClientMembershipTargetTransferCommand command,
        CancellationToken cancellationToken)
    {
        var validation = ValidateCommand(command, requireExpectedMemberships: true);
        if (!validation.Succeeded)
        {
            return validation;
        }

        await using var transaction = await BeginTransactionAsync(cancellationToken);
        try
        {
            await LockTransferRowsAsync(
                clientId,
                command.SourceGroupId!.Value,
                command.TargetGroupId!.Value,
                cancellationToken);

            var preview = await BuildPreviewAsync(
                clientId,
                command,
                tracking: true,
                requireExpectedMemberships: true,
                cancellationToken);
            if (!preview.Succeeded)
            {
                await RollbackIfPresentAsync(transaction, cancellationToken);
                return preview;
            }

            var sourceGroupId = command.SourceGroupId!.Value;
            var targetGroupId = command.TargetGroupId!.Value;
            var targetBranchId = preview.Preview!.AffectedMemberships
                .SelectMany(item => item.AfterTargets)
                .First(target => target.GroupId == targetGroupId)
                .BranchId;
            var affectedIds = preview.Preview.AffectedMemberships
                .Select(item => item.MembershipId)
                .ToHashSet();

            var memberships = await dbContext.ClientMemberships
                .Include(membership => membership.TargetGroups)
                .Where(membership => affectedIds.Contains(membership.Id))
                .ToArrayAsync(cancellationToken);
            foreach (var membership in memberships)
            {
                var target = membership.TargetGroups.Single(candidate => candidate.GroupId == sourceGroupId);
                target.GroupId = targetGroupId;
                target.BranchId = targetBranchId;
            }

            await EnsureTargetAssignmentAsync(clientId, targetGroupId, targetBranchId, command.ActorUserId, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await CommitIfPresentAsync(transaction, cancellationToken);
            return preview;
        }
        catch
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task<ClientMembershipTargetTransferResult> BuildPreviewAsync(
        Guid clientId,
        ClientMembershipTargetTransferCommand command,
        bool tracking,
        bool requireExpectedMemberships,
        CancellationToken cancellationToken)
    {
        var validation = ValidateCommand(command, requireExpectedMemberships);
        if (!validation.Succeeded)
        {
            return validation;
        }

        if (!await dbContext.Clients.AsNoTracking().AnyAsync(client => client.Id == clientId, cancellationToken))
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.ClientMissing,
                "clientId",
                "Клиент не найден.");
        }

        var sourceGroupId = command.SourceGroupId!.Value;
        var targetGroupId = command.TargetGroupId!.Value;
        var groupIds = new[] { sourceGroupId, targetGroupId };
        var groups = await dbContext.TrainingGroups
            .AsNoTracking()
            .Include(group => group.Branch)
            .Where(group => groupIds.Contains(group.Id))
            .ToDictionaryAsync(group => group.Id, cancellationToken);
        if (!groups.TryGetValue(sourceGroupId, out var sourceGroup) ||
            !groups.TryGetValue(targetGroupId, out var targetGroup) ||
            !targetGroup.IsActive)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.TargetUnavailable,
                "targetGroupId",
                "Целевая группа недоступна.");
        }

        if (sourceGroup.BranchId != targetGroup.BranchId)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.CrossBranchTarget,
                "targetGroupId",
                "Группа для переноса должна быть в том же филиале.");
        }

        var query = dbContext.ClientMemberships
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .Where(membership =>
                membership.ClientId == clientId &&
                membership.ValidTo == null);
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        var memberships = await query.AsSplitQuery().ToArrayAsync(cancellationToken);
        var affectedMemberships = memberships
            .Where(membership => membership.TargetGroups.Any(target => target.GroupId == sourceGroupId))
            .Where(membership =>
            {
                var state = ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDateProvider.Today);
                return state is ClientMembershipEntitlementState.Active or ClientMembershipEntitlementState.Future;
            })
            .OrderBy(membership => membership.Id)
            .ToArray();

        if (requireExpectedMemberships)
        {
            var expected = command.ExpectedMembershipIds.Order().ToArray();
            var actual = affectedMemberships.Select(membership => membership.Id).Order().ToArray();
            if (!expected.SequenceEqual(actual))
            {
                return ClientMembershipTargetTransferResult.Failure(
                    ClientMembershipTargetTransferStatus.StaleExpectedMemberships,
                    "expectedMembershipIds",
                    "Список абонементов изменился. Обновите предпросмотр и повторите перенос.");
            }
        }

        var projectedTargetsByMembership = new Dictionary<Guid, IReadOnlyList<ClientMembershipTargetSnapshotResult>>();
        var items = new List<ClientMembershipTargetTransferItemResult>();
        foreach (var membership in affectedMemberships)
        {
            if (membership.TargetGroups.Any(target => target.GroupId == targetGroupId))
            {
                return ClientMembershipTargetTransferResult.Failure(
                    ClientMembershipTargetTransferStatus.DuplicateTarget,
                    "targetGroupId",
                    "Целевая группа уже есть в одном из затронутых абонементов.");
            }

            var before = MapTargets(membership.TargetGroups);
            var after = before
                .Select(target => target.GroupId == sourceGroupId
                    ? new ClientMembershipTargetSnapshotResult(
                        targetGroup.Id,
                        targetGroup.Name,
                        targetGroup.BranchId,
                        targetGroup.Branch.Name,
                        target.Position,
                        targetGroup.IsActive)
                    : target)
                .OrderBy(target => target.Position)
                .ToArray();

            projectedTargetsByMembership[membership.Id] = after;
            items.Add(new ClientMembershipTargetTransferItemResult(
                membership.Id,
                membership.SaleId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind,
                before,
                after));
        }

        foreach (var membership in memberships.Where(membership => !projectedTargetsByMembership.ContainsKey(membership.Id)))
        {
            projectedTargetsByMembership[membership.Id] = MapTargets(membership.TargetGroups);
        }

        var overlap = FindProjectedOverlap(memberships, projectedTargetsByMembership);
        if (overlap is not null)
        {
            return ClientMembershipTargetTransferResult.Failure(
                overlap == ClientMembershipTargetTransferStatus.MembershipTargetMissing
                    ? ClientMembershipTargetTransferStatus.MembershipTargetMissing
                    : ClientMembershipTargetTransferStatus.MembershipOverlap,
                "targetGroupId",
                overlap == ClientMembershipTargetTransferStatus.MembershipTargetMissing
                    ? "Абонемент без групп нужно сначала исправить."
                    : "Перенос создаёт пересечение действующих абонементов.");
        }

        return ClientMembershipTargetTransferResult.Success(new ClientMembershipTargetTransferPreviewResult(
            clientId,
            sourceGroupId,
            targetGroupId,
            items
                .OrderBy(item => item.MembershipName, StringComparer.CurrentCulture)
                .ThenBy(item => item.MembershipId)
                .ToArray()));
    }

    private static ClientMembershipTargetTransferResult ValidateCommand(
        ClientMembershipTargetTransferCommand command,
        bool requireExpectedMemberships)
    {
        if (!command.SourceGroupId.HasValue || command.SourceGroupId.Value == Guid.Empty)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.InvalidRequest,
                "sourceGroupId",
                "Исходная группа обязательна.");
        }

        if (!command.TargetGroupId.HasValue || command.TargetGroupId.Value == Guid.Empty)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.InvalidRequest,
                "targetGroupId",
                "Целевая группа обязательна.");
        }

        if (command.SourceGroupId == command.TargetGroupId)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.InvalidRequest,
                "targetGroupId",
                "Выберите другую целевую группу.");
        }

        if (requireExpectedMemberships && command.ExpectedMembershipIds.Count == 0)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.InvalidRequest,
                "expectedMembershipIds",
                "Передайте список абонементов из предпросмотра.");
        }

        if (command.ExpectedMembershipIds.Any(id => id == Guid.Empty) ||
            command.ExpectedMembershipIds.Distinct().Count() != command.ExpectedMembershipIds.Count)
        {
            return ClientMembershipTargetTransferResult.Failure(
                ClientMembershipTargetTransferStatus.InvalidRequest,
                "expectedMembershipIds",
                "Список абонементов содержит некорректные значения.");
        }

        return ClientMembershipTargetTransferResult.Success(new ClientMembershipTargetTransferPreviewResult(
            Guid.Empty,
            Guid.Empty,
            Guid.Empty,
            []));
    }

    private ClientMembershipTargetTransferStatus? FindProjectedOverlap(
        IReadOnlyList<ClientMembership> memberships,
        IReadOnlyDictionary<Guid, IReadOnlyList<ClientMembershipTargetSnapshotResult>> projectedTargetsByMembership)
    {
        var current = memberships
            .Where(membership =>
            {
                var state = ClientMembershipTargetPolicy.ResolveEntitlementState(membership, businessDateProvider.Today);
                return state is ClientMembershipEntitlementState.Active or ClientMembershipEntitlementState.Future;
            })
            .OrderBy(membership => membership.Id)
            .ToArray();

        if (current.Any(membership => projectedTargetsByMembership[membership.Id].Count == 0))
        {
            return ClientMembershipTargetTransferStatus.MembershipTargetMissing;
        }

        for (var leftIndex = 0; leftIndex < current.Length; leftIndex++)
        {
            for (var rightIndex = leftIndex + 1; rightIndex < current.Length; rightIndex++)
            {
                var left = current[leftIndex];
                var right = current[rightIndex];
                if (!ClientMembershipTargetPolicy.EffectivePeriodsOverlap(
                        left.BehaviorKind,
                        left.IndividualValidFrom ?? left.Sale.PurchaseDate,
                        left.IndividualValidTo,
                        left.SingleVisitUsed,
                        right.BehaviorKind,
                        right.IndividualValidFrom ?? right.Sale.PurchaseDate,
                        right.IndividualValidTo))
                {
                    continue;
                }

                if (ClientMembershipTargetPolicy.TargetSetsOverlap(
                        left.BehaviorKind,
                        projectedTargetsByMembership[left.Id].Select(target => target.GroupId).ToArray(),
                        right.BehaviorKind,
                        projectedTargetsByMembership[right.Id].Select(target => target.GroupId).ToArray()))
                {
                    return ClientMembershipTargetTransferStatus.MembershipOverlap;
                }
            }
        }

        return null;
    }

    private async Task EnsureTargetAssignmentAsync(
        Guid clientId,
        Guid targetGroupId,
        Guid targetBranchId,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.ClientGroups.AnyAsync(
                clientGroup => clientGroup.ClientId == clientId && clientGroup.GroupId == targetGroupId,
                cancellationToken))
        {
            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientId,
                GroupId = targetGroupId,
                BranchId = targetBranchId
            });
        }

        var today = businessDateProvider.Today;
        if (!await dbContext.ClientGroupAssignments.AnyAsync(
                assignment =>
                    assignment.ClientId == clientId &&
                    assignment.GroupId == targetGroupId &&
                    assignment.ValidFrom <= today &&
                    (assignment.ValidTo == null || assignment.ValidTo > today),
                cancellationToken))
        {
            var now = timeProvider.GetUtcNow();
            dbContext.ClientGroupAssignments.Add(new ClientGroupAssignment
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                GroupId = targetGroupId,
                ValidFrom = today,
                CreatedByUserId = actorUserId,
                CreatedAt = now
            });
        }
    }

    private static IReadOnlyList<ClientMembershipTargetSnapshotResult> MapTargets(
        IEnumerable<ClientMembershipTargetGroup> targets)
    {
        return targets
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipTargetSnapshotResult(
                target.GroupId,
                target.Group.Name,
                target.BranchId,
                target.Group.Branch.Name,
                target.Position,
                target.Group.IsActive))
            .ToArray();
    }

    private async Task<IDbContextTransaction?> BeginTransactionAsync(CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory" ||
               dbContext.Database.CurrentTransaction is not null
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private async Task LockTransferRowsAsync(
        Guid clientId,
        Guid sourceGroupId,
        Guid targetGroupId,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" IN ({sourceGroupId}, {targetGroupId}) ORDER BY "Id" FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL ORDER BY "Id" FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMembershipTargetGroups" WHERE "ClientMembershipId" IN (SELECT "Id" FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL) ORDER BY "ClientMembershipId", "Position" FOR UPDATE""",
            cancellationToken);
    }

    private static async Task CommitIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private static async Task RollbackIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }
}
