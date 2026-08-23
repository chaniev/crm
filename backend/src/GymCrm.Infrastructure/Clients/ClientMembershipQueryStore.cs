using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipQueryStore(GymCrmDbContext dbContext)
{
    public async Task<bool> ClientExistsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .AnyAsync(client => client.Id == clientId, cancellationToken);
    }

    public async Task<ClientMembership?> LoadCurrentMembershipAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var openMemberships = await dbContext.ClientMemberships
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CreatedByUser)
            .Where(membership => membership.ClientId == clientId && membership.ValidTo == null)
            .ToListAsync(cancellationToken);

        return openMemberships
            .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .FirstOrDefault();
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
        Guid? exceptMembershipId,
        CancellationToken cancellationToken)
    {
        if (behaviorKind is not (MembershipBehaviorKind.Term or MembershipBehaviorKind.Professional))
        {
            return false;
        }

        if (!validFrom.HasValue)
        {
            return false;
        }

        var query = dbContext.ClientMemberships.AsNoTracking()
            .Where(membership =>
                membership.ClientId == clientId &&
                membership.ValidTo == null &&
                membership.BehaviorKind != MembershipBehaviorKind.SingleVisit);
        if (exceptMembershipId.HasValue)
        {
            query = query.Where(membership => membership.Id != exceptMembershipId.Value);
        }

        var requestedFrom = validFrom.Value;
        var requestedTo = validTo;
        return await query.AnyAsync(
            membership =>
                membership.IndividualValidFrom.HasValue &&
                membership.IndividualValidFrom.Value <= (requestedTo ?? DateOnly.MaxValue) &&
                (membership.IndividualValidTo ?? DateOnly.MaxValue) >= requestedFrom,
            cancellationToken);
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
