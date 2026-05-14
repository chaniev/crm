using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class TrainingGroupListQuery
{
    public static IQueryable<TrainingGroup> CreateBaseQuery(
        GymCrmDbContext dbContext,
        bool? isActive = null)
    {
        var query = dbContext.TrainingGroups.AsNoTracking();
        if (isActive.HasValue)
        {
            query = query.Where(group => group.IsActive == isActive.Value);
        }

        return query;
    }

    public static Task<List<TrainingGroup>> LoadPageAsync(
        IQueryable<TrainingGroup> query,
        GroupPaging paging,
        CancellationToken cancellationToken)
    {
        return query
            .OrderBy(group => group.Name)
            .ThenBy(group => group.TrainingStartTime)
            .ThenBy(group => group.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.GroupType)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
    }
}
