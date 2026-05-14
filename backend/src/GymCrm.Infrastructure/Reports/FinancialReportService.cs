using GymCrm.Application.Reports;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Reports;

internal sealed class FinancialReportService(GymCrmDbContext dbContext) : IFinancialReportService
{
    public async Task<FinancialReportResult> GetFinancialReportAsync(
        FinancialReportQuery query,
        CancellationToken cancellationToken)
    {
        var events = await LoadFinancialEventsAsync(query, cancellationToken);
        if (events.Length == 0)
        {
            return EmptyResult();
        }

        var clientIds = events
            .Select(financialEvent => financialEvent.ClientId)
            .Distinct()
            .ToArray();

        var firstSales = await LoadFirstSalesAsync(clientIds, cancellationToken);
        var branchAssignments = await LoadBranchAssignmentsAsync(clientIds, query, cancellationToken);
        var branchIds = branchAssignments
            .Select(assignment => assignment.BranchId)
            .Distinct()
            .ToArray();
        var branchesById = await LoadBranchesAsync(branchIds, cancellationToken);

        var groupAssignments = await LoadGroupAssignmentsAsync(clientIds, query, cancellationToken);
        var groupIds = groupAssignments
            .Select(assignment => assignment.GroupId)
            .Distinct()
            .ToArray();
        var groupsById = await LoadGroupsAsync(groupIds, cancellationToken);

        var trainerAssignments = await LoadTrainerAssignmentsAsync(groupIds, query, cancellationToken);
        var trainerIds = trainerAssignments
            .Select(assignment => assignment.TrainerId)
            .Distinct()
            .ToArray();
        var trainersById = await LoadTrainersAsync(trainerIds, cancellationToken);

        var attributedEvents = CreateAttributedEvents(
            events,
            firstSales,
            branchAssignments,
            branchesById,
            groupAssignments,
            groupsById,
            trainerAssignments,
            trainersById,
            query);

        if (attributedEvents.Count == 0)
        {
            return EmptyResult();
        }

        return new FinancialReportResult(
            CalculateCanonicalTotals(attributedEvents),
            CalculateBranchBreakdown(attributedEvents),
            CalculateGroupBreakdown(attributedEvents, query.TrainerId),
            CalculateTrainerBreakdown(attributedEvents, query.TrainerId));
    }

    private async Task<FinancialEventProjection[]> LoadFinancialEventsAsync(
        FinancialReportQuery query,
        CancellationToken cancellationToken)
    {
        var sales = await dbContext.ClientMembershipSales
            .AsNoTracking()
            .Where(sale => sale.PurchaseDate >= query.From && sale.PurchaseDate <= query.To)
            .Select(sale => new FinancialEventProjection(
                sale.Id,
                sale.ClientId,
                sale.PurchaseDate,
                FinancialEventKind.Sale,
                sale.GrossAmount,
                0m))
            .ToArrayAsync(cancellationToken);

        var refunds = await dbContext.ClientMembershipRefunds
            .AsNoTracking()
            .Where(refund =>
                refund.CanceledAt == null &&
                refund.RefundDate >= query.From &&
                refund.RefundDate <= query.To)
            .Select(refund => new FinancialEventProjection(
                refund.Id,
                refund.ClientId,
                refund.RefundDate,
                FinancialEventKind.Refund,
                0m,
                refund.Amount))
            .ToArrayAsync(cancellationToken);

        return sales
            .Concat(refunds)
            .OrderBy(financialEvent => financialEvent.EventDate)
            .ThenBy(financialEvent => financialEvent.Kind)
            .ThenBy(financialEvent => financialEvent.Id)
            .ToArray();
    }

    private async Task<IReadOnlyDictionary<Guid, FirstSaleProjection>> LoadFirstSalesAsync(
        IReadOnlyCollection<Guid> clientIds,
        CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
        {
            return new Dictionary<Guid, FirstSaleProjection>();
        }

        var sales = await dbContext.ClientMembershipSales
            .AsNoTracking()
            .Where(sale => clientIds.Contains(sale.ClientId))
            .Select(sale => new
            {
                sale.Id,
                sale.ClientId,
                sale.PurchaseDate,
                sale.CreatedAt
            })
            .ToArrayAsync(cancellationToken);

        return sales
            .GroupBy(sale => sale.ClientId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var firstSale = group
                        .OrderBy(sale => sale.PurchaseDate)
                        .ThenBy(sale => sale.CreatedAt)
                        .ThenBy(sale => sale.Id)
                        .First();

                    return new FirstSaleProjection(firstSale.Id, firstSale.PurchaseDate);
                });
    }

    private async Task<BranchAssignmentProjection[]> LoadBranchAssignmentsAsync(
        IReadOnlyCollection<Guid> clientIds,
        FinancialReportQuery query,
        CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
        {
            return [];
        }

        return await dbContext.ClientBranchAssignments
            .AsNoTracking()
            .Where(assignment =>
                clientIds.Contains(assignment.ClientId) &&
                assignment.ValidFrom <= query.To &&
                (assignment.ValidTo == null || assignment.ValidTo > query.From))
            .Select(assignment => new BranchAssignmentProjection(
                assignment.Id,
                assignment.ClientId,
                assignment.BranchId,
                assignment.ValidFrom,
                assignment.ValidTo))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, BranchProjection>> LoadBranchesAsync(
        IReadOnlyCollection<Guid> branchIds,
        CancellationToken cancellationToken)
    {
        if (branchIds.Count == 0)
        {
            return new Dictionary<Guid, BranchProjection>();
        }

        return await dbContext.Branches
            .AsNoTracking()
            .Where(branch => branchIds.Contains(branch.Id))
            .Select(branch => new BranchProjection(branch.Id, branch.Name))
            .ToDictionaryAsync(branch => branch.Id, cancellationToken);
    }

    private async Task<GroupAssignmentProjection[]> LoadGroupAssignmentsAsync(
        IReadOnlyCollection<Guid> clientIds,
        FinancialReportQuery query,
        CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
        {
            return [];
        }

        return await dbContext.ClientGroupAssignments
            .AsNoTracking()
            .Where(assignment =>
                clientIds.Contains(assignment.ClientId) &&
                assignment.ValidFrom <= query.To &&
                (assignment.ValidTo == null || assignment.ValidTo > query.From))
            .Select(assignment => new GroupAssignmentProjection(
                assignment.Id,
                assignment.ClientId,
                assignment.GroupId,
                assignment.ValidFrom,
                assignment.ValidTo))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, GroupProjection>> LoadGroupsAsync(
        IReadOnlyCollection<Guid> groupIds,
        CancellationToken cancellationToken)
    {
        if (groupIds.Count == 0)
        {
            return new Dictionary<Guid, GroupProjection>();
        }

        return await (
                from trainingGroup in dbContext.TrainingGroups.AsNoTracking()
                join branch in dbContext.Branches.AsNoTracking() on trainingGroup.BranchId equals branch.Id
                where groupIds.Contains(trainingGroup.Id)
                select new GroupProjection(
                    trainingGroup.Id,
                    trainingGroup.Name,
                    trainingGroup.BranchId,
                    branch.Name))
            .ToDictionaryAsync(group => group.Id, cancellationToken);
    }

    private async Task<TrainerAssignmentProjection[]> LoadTrainerAssignmentsAsync(
        IReadOnlyCollection<Guid> groupIds,
        FinancialReportQuery query,
        CancellationToken cancellationToken)
    {
        if (groupIds.Count == 0)
        {
            return [];
        }

        return await dbContext.GroupTrainerAssignments
            .AsNoTracking()
            .Where(assignment =>
                groupIds.Contains(assignment.GroupId) &&
                assignment.ValidFrom <= query.To &&
                (assignment.ValidTo == null || assignment.ValidTo > query.From))
            .Select(assignment => new TrainerAssignmentProjection(
                assignment.Id,
                assignment.GroupId,
                assignment.TrainerId,
                assignment.ValidFrom,
                assignment.ValidTo))
            .ToArrayAsync(cancellationToken);
    }

    private async Task<IReadOnlyDictionary<Guid, TrainerProjection>> LoadTrainersAsync(
        IReadOnlyCollection<Guid> trainerIds,
        CancellationToken cancellationToken)
    {
        if (trainerIds.Count == 0)
        {
            return new Dictionary<Guid, TrainerProjection>();
        }

        return await dbContext.Users
            .AsNoTracking()
            .Where(user => trainerIds.Contains(user.Id))
            .Select(user => new TrainerProjection(user.Id, user.FullName))
            .ToDictionaryAsync(trainer => trainer.Id, cancellationToken);
    }

    private static List<AttributedFinancialEvent> CreateAttributedEvents(
        IReadOnlyList<FinancialEventProjection> events,
        IReadOnlyDictionary<Guid, FirstSaleProjection> firstSales,
        IReadOnlyList<BranchAssignmentProjection> branchAssignments,
        IReadOnlyDictionary<Guid, BranchProjection> branchesById,
        IReadOnlyList<GroupAssignmentProjection> groupAssignments,
        IReadOnlyDictionary<Guid, GroupProjection> groupsById,
        IReadOnlyList<TrainerAssignmentProjection> trainerAssignments,
        IReadOnlyDictionary<Guid, TrainerProjection> trainersById,
        FinancialReportQuery query)
    {
        var attributedEvents = new List<AttributedFinancialEvent>(events.Count);

        foreach (var financialEvent in events)
        {
            var branchAssignment = ResolveBranchAssignment(
                branchAssignments,
                financialEvent.ClientId,
                financialEvent.EventDate);
            if (branchAssignment is null ||
                !branchesById.TryGetValue(branchAssignment.BranchId, out var branch))
            {
                continue;
            }

            if (query.BranchId.HasValue && branch.Id != query.BranchId.Value)
            {
                continue;
            }

            var groupAttributions = ResolveGroupAttributions(
                groupAssignments,
                groupsById,
                financialEvent.ClientId,
                financialEvent.EventDate,
                branch.Id);
            var trainerAttributions = ResolveTrainerAttributions(
                trainerAssignments,
                trainersById,
                groupAttributions,
                financialEvent.EventDate);

            if (query.TrainerId.HasValue &&
                trainerAttributions.All(attribution => attribution.TrainerId != query.TrainerId.Value))
            {
                continue;
            }

            var isFirstSale = financialEvent.Kind == FinancialEventKind.Sale &&
                firstSales.TryGetValue(financialEvent.ClientId, out var firstSale) &&
                firstSale.Id == financialEvent.Id;

            attributedEvents.Add(new AttributedFinancialEvent(
                financialEvent,
                branch,
                groupAttributions,
                trainerAttributions,
                isFirstSale));
        }

        return attributedEvents;
    }

    private static BranchAssignmentProjection? ResolveBranchAssignment(
        IEnumerable<BranchAssignmentProjection> assignments,
        Guid clientId,
        DateOnly eventDate)
    {
        return assignments
            .Where(assignment =>
                assignment.ClientId == clientId &&
                ContainsDate(assignment.ValidFrom, assignment.ValidTo, eventDate))
            .OrderByDescending(assignment => assignment.ValidFrom)
            .ThenBy(assignment => assignment.Id)
            .FirstOrDefault();
    }

    private static IReadOnlyList<GroupAttribution> ResolveGroupAttributions(
        IEnumerable<GroupAssignmentProjection> assignments,
        IReadOnlyDictionary<Guid, GroupProjection> groupsById,
        Guid clientId,
        DateOnly eventDate,
        Guid branchId)
    {
        return assignments
            .Where(assignment =>
                assignment.ClientId == clientId &&
                ContainsDate(assignment.ValidFrom, assignment.ValidTo, eventDate) &&
                groupsById.TryGetValue(assignment.GroupId, out var group) &&
                group.BranchId == branchId)
            .Select(assignment => groupsById[assignment.GroupId])
            .OrderBy(group => group.Name)
            .ThenBy(group => group.Id)
            .Select(group => new GroupAttribution(
                group.Id,
                group.Name,
                group.BranchId,
                group.BranchName))
            .ToArray();
    }

    private static IReadOnlyList<TrainerAttribution> ResolveTrainerAttributions(
        IEnumerable<TrainerAssignmentProjection> assignments,
        IReadOnlyDictionary<Guid, TrainerProjection> trainersById,
        IReadOnlyList<GroupAttribution> groupAttributions,
        DateOnly eventDate)
    {
        if (groupAttributions.Count == 0)
        {
            return [];
        }

        var groupIds = groupAttributions.Select(group => group.GroupId).ToHashSet();

        return assignments
            .Where(assignment =>
                groupIds.Contains(assignment.GroupId) &&
                ContainsDate(assignment.ValidFrom, assignment.ValidTo, eventDate) &&
                trainersById.TryGetValue(assignment.TrainerId, out _))
            .OrderBy(assignment => trainersById[assignment.TrainerId].FullName)
            .ThenBy(assignment => assignment.TrainerId)
            .ThenBy(assignment => assignment.GroupId)
            .ThenBy(assignment => assignment.Id)
            .Select(assignment => new TrainerAttribution(
                assignment.GroupId,
                assignment.TrainerId,
                trainersById[assignment.TrainerId].FullName))
            .ToArray();
    }

    private static FinancialReportTotals CalculateCanonicalTotals(
        IReadOnlyList<AttributedFinancialEvent> attributedEvents)
    {
        var totals = new TotalsAccumulator();
        foreach (var attributedEvent in attributedEvents)
        {
            totals.Add(attributedEvent.Event, attributedEvent.IsFirstSale);
        }

        return totals.ToTotals();
    }

    private static IReadOnlyList<FinancialReportBranchBreakdownRow> CalculateBranchBreakdown(
        IReadOnlyList<AttributedFinancialEvent> attributedEvents)
    {
        return attributedEvents
            .GroupBy(attributedEvent => attributedEvent.Branch)
            .OrderBy(group => group.Key.Name)
            .ThenBy(group => group.Key.Id)
            .Select(group =>
            {
                var totals = new TotalsAccumulator();
                foreach (var attributedEvent in group)
                {
                    totals.Add(attributedEvent.Event, attributedEvent.IsFirstSale);
                }

                var result = totals.ToTotals();
                return new FinancialReportBranchBreakdownRow(
                    group.Key.Id,
                    group.Key.Name,
                    result.SoldMembershipCount,
                    result.GrossSales,
                    result.RefundTotal,
                    result.NetTotal,
                    result.NewClientsCount);
            })
            .ToArray();
    }

    private static IReadOnlyList<FinancialReportGroupBreakdownRow> CalculateGroupBreakdown(
        IReadOnlyList<AttributedFinancialEvent> attributedEvents,
        Guid? trainerId)
    {
        return attributedEvents
            .SelectMany(attributedEvent =>
            {
                var groupAttributions = trainerId.HasValue
                    ? attributedEvent.GroupAttributions.Where(group => attributedEvent.TrainerAttributions.Any(
                        trainer => trainer.GroupId == group.GroupId && trainer.TrainerId == trainerId.Value))
                    : attributedEvent.GroupAttributions;

                return groupAttributions.Select(group => new
                {
                    Group = group,
                    attributedEvent.Event,
                    attributedEvent.IsFirstSale
                });
            })
            .GroupBy(row => row.Group)
            .OrderBy(group => group.Key.BranchName)
            .ThenBy(group => group.Key.GroupName)
            .ThenBy(group => group.Key.GroupId)
            .Select(group =>
            {
                var totals = new TotalsAccumulator();
                foreach (var row in group)
                {
                    totals.Add(row.Event, row.IsFirstSale);
                }

                var result = totals.ToTotals();
                return new FinancialReportGroupBreakdownRow(
                    group.Key.GroupId,
                    group.Key.GroupName,
                    group.Key.BranchId,
                    group.Key.BranchName,
                    result.SoldMembershipCount,
                    result.GrossSales,
                    result.RefundTotal,
                    result.NetTotal,
                    result.NewClientsCount);
            })
            .ToArray();
    }

    private static IReadOnlyList<FinancialReportTrainerBreakdownRow> CalculateTrainerBreakdown(
        IReadOnlyList<AttributedFinancialEvent> attributedEvents,
        Guid? trainerId)
    {
        return attributedEvents
            .SelectMany(attributedEvent => attributedEvent.TrainerAttributions
                .Where(trainer => !trainerId.HasValue || trainer.TrainerId == trainerId.Value)
                .Select(trainer => new
                {
                    Trainer = trainer,
                    attributedEvent.Event,
                    attributedEvent.IsFirstSale
                }))
            .GroupBy(row => new
            {
                row.Trainer.TrainerId,
                row.Trainer.TrainerName
            })
            .OrderBy(group => group.Key.TrainerName)
            .ThenBy(group => group.Key.TrainerId)
            .Select(group =>
            {
                var totals = new TotalsAccumulator();
                foreach (var row in group)
                {
                    totals.Add(row.Event, row.IsFirstSale);
                }

                var result = totals.ToTotals();
                return new FinancialReportTrainerBreakdownRow(
                    group.Key.TrainerId,
                    group.Key.TrainerName,
                    result.SoldMembershipCount,
                    result.GrossSales,
                    result.RefundTotal,
                    result.NetTotal,
                    result.NewClientsCount);
            })
            .ToArray();
    }

    private static bool ContainsDate(DateOnly validFrom, DateOnly? validTo, DateOnly eventDate)
    {
        return validFrom <= eventDate && (validTo is null || eventDate < validTo.Value);
    }

    private static FinancialReportResult EmptyResult()
    {
        return new FinancialReportResult(
            new FinancialReportTotals(0, 0m, 0m, 0m, 0),
            [],
            [],
            []);
    }

    private enum FinancialEventKind
    {
        Sale = 0,
        Refund = 1
    }

    private sealed record FinancialEventProjection(
        Guid Id,
        Guid ClientId,
        DateOnly EventDate,
        FinancialEventKind Kind,
        decimal GrossSales,
        decimal RefundTotal);

    private sealed record BranchAssignmentProjection(
        Guid Id,
        Guid ClientId,
        Guid BranchId,
        DateOnly ValidFrom,
        DateOnly? ValidTo);

    private sealed record GroupAssignmentProjection(
        Guid Id,
        Guid ClientId,
        Guid GroupId,
        DateOnly ValidFrom,
        DateOnly? ValidTo);

    private sealed record TrainerAssignmentProjection(
        Guid Id,
        Guid GroupId,
        Guid TrainerId,
        DateOnly ValidFrom,
        DateOnly? ValidTo);

    private sealed record BranchProjection(Guid Id, string Name);

    private sealed record GroupProjection(
        Guid Id,
        string Name,
        Guid BranchId,
        string BranchName);

    private sealed record TrainerProjection(Guid Id, string FullName);

    private sealed record FirstSaleProjection(Guid Id, DateOnly PurchaseDate);

    private sealed record GroupAttribution(
        Guid GroupId,
        string GroupName,
        Guid BranchId,
        string BranchName);

    private sealed record TrainerAttribution(
        Guid GroupId,
        Guid TrainerId,
        string TrainerName);

    private sealed record AttributedFinancialEvent(
        FinancialEventProjection Event,
        BranchProjection Branch,
        IReadOnlyList<GroupAttribution> GroupAttributions,
        IReadOnlyList<TrainerAttribution> TrainerAttributions,
        bool IsFirstSale);

    private sealed class TotalsAccumulator
    {
        private int soldMembershipCount;
        private decimal grossSales;
        private decimal refundTotal;
        private int newClientsCount;

        public void Add(FinancialEventProjection financialEvent, bool isFirstSale)
        {
            if (financialEvent.Kind == FinancialEventKind.Sale)
            {
                soldMembershipCount++;
                grossSales += financialEvent.GrossSales;
            }
            else
            {
                refundTotal += financialEvent.RefundTotal;
            }

            if (isFirstSale)
            {
                newClientsCount++;
            }
        }

        public FinancialReportTotals ToTotals()
        {
            return new FinancialReportTotals(
                soldMembershipCount,
                grossSales,
                refundTotal,
                grossSales - refundTotal,
                newClientsCount);
        }
    }
}
