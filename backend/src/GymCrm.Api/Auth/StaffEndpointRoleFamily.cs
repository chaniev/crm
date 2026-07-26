using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal enum StaffEndpointRoleFamily
{
    Trainers = 1,
    Administrators = 2
}

internal static class StaffEndpointRoleFamilies
{
    public static bool Contains(StaffEndpointRoleFamily family, UserRole role)
    {
        return family switch
        {
            StaffEndpointRoleFamily.Trainers => role == UserRole.Coach,
            StaffEndpointRoleFamily.Administrators => role is UserRole.Administrator or UserRole.SuperAdministrator,
            _ => throw new ArgumentOutOfRangeException(nameof(family), family, "Unsupported staff endpoint role family.")
        };
    }

    public static bool CanUseHeadCoachSelfUpdateException(
        StaffEndpointRoleFamily family,
        User actor,
        User target)
    {
        return family == StaffEndpointRoleFamily.Trainers &&
            actor.Id == target.Id &&
            actor.Role == UserRole.HeadCoach &&
            target.Role == UserRole.HeadCoach;
    }
}
