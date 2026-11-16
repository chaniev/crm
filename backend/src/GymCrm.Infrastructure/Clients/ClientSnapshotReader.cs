using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

public static class ClientSnapshotReader
{
    public static async Task<Client?> LoadAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Branch)
            .Include(client => client.NotesChangedByUser)
            .Include(client => client.Contacts)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.Refunds)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.CommentChangedByUser)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.CreatedByUser)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
                    .ThenInclude(target => target.Group)
                        .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
    }

    public static async Task<Client?> LoadAuthorizedAsync(
        Guid clientId, Guid actorId, GymCrmDbContext dbContext, CancellationToken cancellationToken)
    {
        await using var lease = await ClientAccessTransaction.BeginReadAsync(dbContext, actorId, [clientId], cancellationToken);
        var actor = await ClientAccessTransaction.LoadActorAsync(dbContext, actorId, cancellationToken);
        if (actor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, actor, clientId, cancellationToken))
        {
            return null;
        }
        return await LoadAsync(clientId, dbContext, cancellationToken);
    }

}
