using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public static class BranchSettingsActionPolicy
{
    public static IReadOnlyList<string> GetSurfaceActions(User actor)
    {
        if (!actor.IsActive)
        {
            return [];
        }

        return actor.Role switch
        {
            UserRole.HeadCoach => Enum.GetNames<BranchSettingsAction>(),
            UserRole.SuperAdministrator =>
            [
                nameof(BranchSettingsAction.View),
                nameof(BranchSettingsAction.CreateBranch),
                nameof(BranchSettingsAction.CreateHall)
            ],
            _ => []
        };
    }

    // Surface actions describe this UI only; HTTP permissions can allow a wider set of operations.
    public static bool CanAttemptMutation(User actor, BranchSettingsAction action)
    {
        if (!actor.IsActive || !Enum.IsDefined(action) || action == BranchSettingsAction.View)
        {
            return false;
        }

        return actor.Role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => true,
            UserRole.Administrator => action != BranchSettingsAction.CreateBranch && actor.BranchId is { } id && id != Guid.Empty,
            _ => false
        };
    }

    public static bool CanMutateTarget(User actor, BranchSettingsAction action, Guid? targetBranchId)
    {
        return CanAttemptMutation(actor, action) &&
            (actor.Role != UserRole.Administrator || actor.BranchId == targetBranchId);
    }
}
