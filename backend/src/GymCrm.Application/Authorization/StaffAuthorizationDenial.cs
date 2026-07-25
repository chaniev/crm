namespace GymCrm.Application.Authorization;

public enum StaffAuthorizationDenial
{
    None = 0,
    StaffManagementForbidden = 1,
    TargetForbidden = 2,
    SelfMutationForbidden = 3,
    RoleTransitionForbidden = 4,
    BranchScopeForbidden = 5,
    AttendanceGrantsMustBeRevoked = 6
}
