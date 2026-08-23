using GymCrm.Application.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Authorization;

internal sealed class EffectiveGroupAssignmentService(
    GymCrmDbContext dbContext) : IEffectiveGroupAssignmentService
{
    public async Task<IReadOnlyList<Guid>> ListEffectiveAssignedGroupIdsAsync(
        Guid trainerId,
        CancellationToken cancellationToken)
    {
        if (trainerId == Guid.Empty)
        {
            return [];
        }

        var permanent = dbContext.GroupTrainers
            .AsNoTracking()
            .Where(groupTrainer => groupTrainer.TrainerId == trainerId)
            .Select(groupTrainer => groupTrainer.GroupId);

        return await permanent
            .OrderBy(groupId => groupId)
            .ToArrayAsync(cancellationToken);
    }

    public async Task<bool> HasEffectiveAssignmentAsync(
        Guid trainerId,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        if (trainerId == Guid.Empty || groupId == Guid.Empty)
        {
            return false;
        }

        return await dbContext.GroupTrainers
            .AsNoTracking()
            .AnyAsync(
                groupTrainer =>
                    groupTrainer.GroupId == groupId &&
                    groupTrainer.TrainerId == trainerId,
                cancellationToken);
    }
}
