namespace GymCrm.Application.Authorization;

public static class GroupTrainerSubstitutionPolicy
{
    public static bool IsEffective(
        DateOnly startsOn,
        DateOnly endsOn,
        DateTimeOffset? cancelledAt,
        DateOnly businessDate) =>
        cancelledAt is null &&
        startsOn <= businessDate &&
        businessDate <= endsOn;

    public static GroupTrainerSubstitutionStatus GetStatus(
        DateOnly startsOn,
        DateOnly endsOn,
        DateTimeOffset? cancelledAt,
        DateOnly businessDate)
    {
        if (cancelledAt is not null)
        {
            return GroupTrainerSubstitutionStatus.Cancelled;
        }

        if (businessDate < startsOn)
        {
            return GroupTrainerSubstitutionStatus.Upcoming;
        }

        return businessDate <= endsOn
            ? GroupTrainerSubstitutionStatus.Active
            : GroupTrainerSubstitutionStatus.Expired;
    }

    public static bool Overlaps(
        DateOnly leftStartsOn,
        DateOnly leftEndsOn,
        DateOnly rightStartsOn,
        DateOnly rightEndsOn) =>
        leftStartsOn <= rightEndsOn && rightStartsOn <= leftEndsOn;

    public static GroupTrainerSubstitutionAllowedActions GetAllowedActions(
        GroupTrainerSubstitutionStatus status,
        bool isGroupActive,
        bool substituteIsPermanentTrainer)
    {
        return status switch
        {
            GroupTrainerSubstitutionStatus.Upcoming => new GroupTrainerSubstitutionAllowedActions(
                CanEdit: isGroupActive && !substituteIsPermanentTrainer,
                CanCancel: true),
            GroupTrainerSubstitutionStatus.Active => new GroupTrainerSubstitutionAllowedActions(
                CanEdit: isGroupActive && !substituteIsPermanentTrainer,
                CanCancel: true),
            _ => new GroupTrainerSubstitutionAllowedActions(false, false)
        };
    }
}
