using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Authorization;

internal sealed class EffectiveGroupAssignmentService(
    GymCrmDbContext dbContext,
    IBusinessDateProvider businessDateProvider) : IEffectiveGroupAssignmentService
{
    public async Task<IReadOnlyList<Guid>> ListEffectiveAssignedGroupIdsAsync(
        Guid trainerId,
        CancellationToken cancellationToken)
    {
        if (trainerId == Guid.Empty)
        {
            return [];
        }

        var today = businessDateProvider.Today;
        var permanent = dbContext.GroupTrainers
            .AsNoTracking()
            .Where(groupTrainer => groupTrainer.TrainerId == trainerId)
            .Select(groupTrainer => groupTrainer.GroupId);
        var temporary = dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .Where(substitution =>
                substitution.SubstituteTrainerId == trainerId &&
                substitution.CancelledAt == null &&
                substitution.StartsOn <= today &&
                substitution.EndsOn >= today)
            .Select(substitution => substitution.GroupId);

        return await permanent
            .Union(temporary)
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

        var today = businessDateProvider.Today;
        return await dbContext.GroupTrainers
            .AsNoTracking()
            .AnyAsync(
                groupTrainer =>
                    groupTrainer.GroupId == groupId &&
                    groupTrainer.TrainerId == trainerId,
                cancellationToken) ||
            await dbContext.GroupTrainerSubstitutions
                .AsNoTracking()
                .AnyAsync(
                    substitution =>
                        substitution.GroupId == groupId &&
                        substitution.SubstituteTrainerId == trainerId &&
                        substitution.CancelledAt == null &&
                        substitution.StartsOn <= today &&
                        substitution.EndsOn >= today,
                    cancellationToken);
    }
}
