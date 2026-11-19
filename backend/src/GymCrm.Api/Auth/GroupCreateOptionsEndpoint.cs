using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class GroupCreateOptionsEndpoint
{
    public static async Task<IResult> HandleAsync(HttpContext httpContext, GymCrmDbContext dbContext, CancellationToken cancellationToken)
    {
        var actor = httpContext.GetAuthenticatedGymCrmUser();
        if (actor is null) return TypedResults.Unauthorized();
        await using var lease = await ClientAccessTransaction.BeginReadAsync(dbContext, actor.Id, [], cancellationToken);
        actor = await ClientAccessTransaction.LoadActorAsync(dbContext, actor.Id, cancellationToken);
        if (actor is null) return TypedResults.Unauthorized();
        if (actor.Role == UserRole.Administrator && !actor.BranchId.HasValue)
            return GroupManagementScope.ForbiddenProblem();

        var branches = await dbContext.Branches.AsNoTracking()
            .Where(branch => !branch.IsArchived)
            .OrderBy(branch => branch.Name).ThenBy(branch => branch.Id)
            .Select(branch => new GroupCreateBranchOptionResponse(branch.Id, branch.Name, branch.Address))
            .ToArrayAsync(cancellationToken);
        var allowedBranches = branches.Where(branch => GroupManagementScope.Contains(actor, branch.Id)).ToArray();
        var branchIds = allowedBranches.Select(branch => branch.Id).ToArray();
        var halls = await dbContext.Halls.AsNoTracking()
            .Where(hall => !hall.IsArchived && branchIds.Contains(hall.BranchId))
            .OrderBy(hall => hall.Name).ThenBy(hall => hall.Id)
            .Select(hall => new GroupCreateHallOptionResponse(hall.Id, hall.BranchId, hall.Name))
            .ToArrayAsync(cancellationToken);
        return TypedResults.Ok(new GroupCreateOptionsResponse(allowedBranches, halls));
    }
}
