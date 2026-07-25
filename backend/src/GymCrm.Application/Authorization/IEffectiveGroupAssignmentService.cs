namespace GymCrm.Application.Authorization;

public interface IEffectiveGroupAssignmentService
{
    Task<IReadOnlyList<Guid>> ListEffectiveAssignedGroupIdsAsync(
        Guid trainerId,
        CancellationToken cancellationToken);

    Task<bool> HasEffectiveAssignmentAsync(
        Guid trainerId,
        Guid groupId,
        CancellationToken cancellationToken);
}
