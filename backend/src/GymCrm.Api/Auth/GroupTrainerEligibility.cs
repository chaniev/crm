using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerEligibility
{
    public static readonly UserRole[] AssignableRoles = [UserRole.Coach, UserRole.HeadCoach];

    public static bool IsAssignableTrainerRole(UserRole role)
    {
        return role is UserRole.Coach or UserRole.HeadCoach;
    }
}
