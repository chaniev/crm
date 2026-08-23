using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipQueryStore(GymCrmDbContext dbContext)
{
    public async Task LockMembershipMutationRowsAsync(
        Guid clientId,
        IReadOnlyCollection<Guid> targetGroupIds,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        foreach (var groupId in targetGroupIds.Distinct().Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
                cancellationToken);
        }

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

    public async Task LockRefundMutationRowsAsync(
        Guid clientId,
        Guid saleId,
        IReadOnlyCollection<Guid> targetGroupIds,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        foreach (var groupId in targetGroupIds.Distinct().Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
                cancellationToken);
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMembershipSales" WHERE "Id" = {saleId} AND "ClientId" = {clientId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMembershipRefunds" WHERE "SaleId" = {saleId} ORDER BY "Id" FOR UPDATE""",
            cancellationToken);
    }

    public async Task<bool> ClientExistsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .AnyAsync(client => client.Id == clientId, cancellationToken);
    }

    public async Task<ClientMembership?> LoadAddressedCurrentMembershipAsync(
        Guid clientId,
        Guid saleId,
        Guid membershipId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ClientMemberships
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CreatedByUser)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .SingleOrDefaultAsync(membership =>
                membership.ClientId == clientId &&
                membership.SaleId == saleId &&
                membership.Id == membershipId &&
                membership.ValidTo == null,
                cancellationToken);
    }

    public async Task<bool> HasActiveMembershipAsync(
        Guid clientId,
        DateOnly today,
        CancellationToken cancellationToken) =>
        await dbContext.ClientMemberships.AnyAsync(membership => membership.ClientId == clientId &&
            (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit
                ? !membership.SingleVisitUsed && membership.ValidTo == null
                : membership.IndividualValidFrom <= today &&
                  (membership.IndividualValidTo == null || membership.IndividualValidTo >= today)),
            cancellationToken);

    public async Task<bool> ActorHasRoleAsync(
        Guid actorId,
        UserRole role,
        CancellationToken cancellationToken) =>
        await dbContext.Users.AnyAsync(user => user.Id == actorId && user.Role == role, cancellationToken);

    public async Task<bool> HasConflictingMembershipAsync(
        Guid clientId,
        MembershipBehaviorKind behaviorKind,
        DateOnly? validFrom,
        DateOnly? validTo,
        IReadOnlyCollection<Guid> targetGroupIds,
        Guid? exceptMembershipId,
        CancellationToken cancellationToken)
    {
        if (targetGroupIds.Count == 0)
        {
            return false;
        }

        var query = dbContext.ClientMemberships.AsNoTracking()
            .Include(membership => membership.Sale)
            .Include(membership => membership.TargetGroups)
            .Where(membership =>
                membership.ClientId == clientId &&
                membership.ValidTo == null);
        if (exceptMembershipId.HasValue)
        {
            query = query.Where(membership => membership.Id != exceptMembershipId.Value);
        }

        var candidates = await query.ToListAsync(cancellationToken);
        return candidates.Any(membership =>
            ClientMembershipTargetPolicy.EffectivePeriodsOverlap(
                membership.BehaviorKind,
                membership.IndividualValidFrom ?? membership.Sale.PurchaseDate,
                membership.IndividualValidTo,
                membership.SingleVisitUsed,
                behaviorKind,
                validFrom,
                validTo) &&
            ClientMembershipTargetPolicy.TargetSetsOverlap(
                membership.BehaviorKind,
                membership.TargetGroups.Select(target => target.GroupId).ToArray(),
                behaviorKind,
                targetGroupIds.ToArray()));
    }

    public async Task<ClientMembershipAddressedMembershipLookup> LoadAddressedMembershipAsync(
        Guid clientId,
        Guid saleId,
        Guid expectedMembershipId,
        CancellationToken cancellationToken)
    {
        var saleExists = await dbContext.ClientMembershipSales
            .AsNoTracking()
            .AnyAsync(sale => sale.Id == saleId && sale.ClientId == clientId, cancellationToken);
        if (!saleExists)
        {
            return new ClientMembershipAddressedMembershipLookup(AddressedMembershipStatus.Missing, null);
        }

        var expectedExists = await dbContext.ClientMemberships
            .AsNoTracking()
            .AnyAsync(membership => membership.Id == expectedMembershipId && membership.ClientId == clientId, cancellationToken);
        if (!expectedExists)
        {
            return new ClientMembershipAddressedMembershipLookup(AddressedMembershipStatus.Missing, null);
        }

        var membership = await dbContext.ClientMemberships
            .Include(candidate => candidate.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(candidate => candidate.Sale)
                .ThenInclude(sale => sale.Refunds)
            .Include(candidate => candidate.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == expectedMembershipId &&
                    candidate.SaleId == saleId &&
                    candidate.ClientId == clientId &&
                    candidate.ValidTo == null,
                cancellationToken);

        return membership is null
            ? new ClientMembershipAddressedMembershipLookup(AddressedMembershipStatus.Conflict, null)
            : new ClientMembershipAddressedMembershipLookup(AddressedMembershipStatus.Found, membership);
    }

    public async Task ReplaceCurrentMembershipAsync(
        ClientMembership? currentMembership,
        ClientMembership nextMembership,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (currentMembership is not null)
        {
            currentMembership.ValidTo = now;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        dbContext.ClientMemberships.Add(nextMembership);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
