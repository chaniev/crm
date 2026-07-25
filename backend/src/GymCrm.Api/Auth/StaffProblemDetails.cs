using GymCrm.Application.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace GymCrm.Api.Auth;

internal static class StaffProblemDetails
{
    public static ProblemHttpResult FromDenial(StaffAuthorizationDenial denial)
    {
        return denial switch
        {
            StaffAuthorizationDenial.StaffManagementForbidden => Create(
                StatusCodes.Status403Forbidden,
                "/problems/staff-management-forbidden",
                "Staff management is forbidden.",
                "staff_management_forbidden"),
            StaffAuthorizationDenial.TargetForbidden => Create(
                StatusCodes.Status403Forbidden,
                "/problems/staff-target-forbidden",
                "Staff target is forbidden.",
                "staff_target_forbidden"),
            StaffAuthorizationDenial.SelfMutationForbidden => Create(
                StatusCodes.Status403Forbidden,
                "/problems/staff-self-mutation-forbidden",
                "Staff self mutation is forbidden.",
                "staff_self_mutation_forbidden"),
            StaffAuthorizationDenial.RoleTransitionForbidden => Create(
                StatusCodes.Status403Forbidden,
                "/problems/staff-role-transition-forbidden",
                "Staff role transition is forbidden.",
                "staff_role_transition_forbidden"),
            StaffAuthorizationDenial.BranchScopeForbidden => Create(
                StatusCodes.Status403Forbidden,
                "/problems/branch-scope-forbidden",
                "Branch scope is forbidden.",
                "branch_scope_forbidden"),
            StaffAuthorizationDenial.AttendanceGrantsMustBeRevoked => Create(
                StatusCodes.Status409Conflict,
                "/problems/attendance-grants-must-be-revoked",
                "Administrator attendance grants must be revoked before staff role or branch changes.",
                "attendance_grants_must_be_revoked"),
            _ => Create(
                StatusCodes.Status403Forbidden,
                "/problems/staff-management-forbidden",
                "Staff management is forbidden.",
                "staff_management_forbidden")
        };
    }

    public static ProblemHttpResult NotFound()
    {
        return Create(
            StatusCodes.Status404NotFound,
            "/problems/staff-not-found",
            "Staff record was not found.",
            "staff_not_found");
    }

    private static ProblemHttpResult Create(int status, string type, string title, string code)
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Status = status,
            Type = type,
            Title = title,
            Extensions = { ["code"] = code }
        });
    }
}
