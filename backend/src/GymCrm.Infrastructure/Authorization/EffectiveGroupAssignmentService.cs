using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Authorization;

internal sealed class EffectiveGroupAssignmentService(
    GymCrmDbContext dbContext,
    IBusinessDateProvider businessDateProvider) : IEffectiveGroupAssignmentService
{
    private IQueryable<TrainerGroupAccess> CurrentAssignments(Guid trainerId, Guid? groupId = null)
    {
        var today = businessDateProvider.Today;
        var permanent = dbContext.GroupTrainers
            .Where(link => link.TrainerId == trainerId && (groupId == null || link.GroupId == groupId))
            .Select(link => new { link.GroupId, StartsOn = (DateOnly?)null, EndsOn = (DateOnly?)null });
        var periods = dbContext.GroupTrainerSubstitutionPeriods
            .Where(p => p.SubstituteTrainerId == trainerId && (groupId == null || p.GroupId == groupId) &&
                p.CancelledAt == null && p.StartsOn <= today && p.EndsOn >= today)
            .Select(p => new { p.GroupId, StartsOn = (DateOnly?)p.StartsOn, EndsOn = (DateOnly?)p.EndsOn });
        return permanent.Concat(periods).Select(a => new TrainerGroupAccess(a.GroupId, a.StartsOn, a.EndsOn));
    }

    public async Task<IReadOnlyList<Guid>> ListEffectiveAssignedGroupIdsAsync(Guid trainerId, CancellationToken cancellationToken)
    {
        var assignments = await ListCurrentAssignmentsAsync(trainerId, null, cancellationToken);
        return assignments.Select(a => a.GroupId).Distinct().Order().ToArray();
    }

    public async Task<IReadOnlyList<TrainerGroupAccess>> ListCurrentAssignmentsAsync(Guid trainerId, Guid? groupId, CancellationToken cancellationToken) =>
        trainerId == Guid.Empty ? [] : await CurrentAssignments(trainerId, groupId).ToArrayAsync(cancellationToken);

    public async Task<bool> HasEffectiveAssignmentAsync(Guid trainerId, Guid groupId, CancellationToken cancellationToken) =>
        trainerId != Guid.Empty && groupId != Guid.Empty && await CurrentAssignments(trainerId, groupId).AnyAsync(cancellationToken);
}
