namespace GymCrm.Application.Authorization;

public interface IEffectiveGroupAssignmentService
{
    Task<IReadOnlyList<Guid>> ListEffectiveAssignedGroupIdsAsync(
        Guid trainerId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<TrainerGroupAccess>> ListCurrentAssignmentsAsync(
        Guid trainerId,
        Guid? groupId,
        CancellationToken cancellationToken);

    Task<bool> HasEffectiveAssignmentAsync(
        Guid trainerId,
        Guid groupId,
        CancellationToken cancellationToken);
}
