using GymCrm.Application.Authorization;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GymCrm.Api.Auth;

internal static class GroupManagementScope
{
    public static IQueryable<TrainingGroup> ApplyTo(IQueryable<TrainingGroup> query, User currentUser)
    {
        return currentUser.Role == UserRole.Administrator
            ? query.Where(group => currentUser.BranchId.HasValue && group.BranchId == currentUser.BranchId.Value)
            : query;
    }

    public static bool Contains(User currentUser, Guid branchId)
    {
        return currentUser.Role is UserRole.HeadCoach or UserRole.SuperAdministrator ||
            currentUser.Role == UserRole.Administrator &&
            currentUser.BranchId.HasValue &&
            currentUser.BranchId.Value == branchId;
    }

    public static ProblemHttpResult ForbiddenProblem() =>
        StaffProblemDetails.FromDenial(StaffAuthorizationDenial.BranchScopeForbidden);
}
