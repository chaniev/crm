using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ScheduleEndpoints
{
    public static IEndpointRouteBuilder MapScheduleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(ScheduleApiConstants.RoutePrefix)
            .RequireAuthorization();

        group.MapGet(ScheduleApiConstants.GroupsRoute, ListGroupsAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<ScheduleGroupListResponse>, ValidationProblem, UnauthorizedHttpResult>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IEffectiveGroupAssignmentService effectiveGroupAssignmentService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var errors = GroupRequestValidator.ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = GroupRequestValidator.ResolvePaging(page, pageSize, skip, take);
        var query = TrainingGroupListQuery.CreateBaseQuery(dbContext);
        if (currentUser.Role == UserRole.Coach)
        {
            var effectiveGroupIds = await effectiveGroupAssignmentService
                .ListEffectiveAssignedGroupIdsAsync(currentUser.Id, cancellationToken);
            query = TrainingGroupListQuery.ApplyGroupIdScope(query, effectiveGroupIds);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var groups = await TrainingGroupListQuery.LoadPageAsync(query, paging, cancellationToken);

        IReadOnlyList<GroupListItemResponse> items = groups
            .Select(TrainingGroupListItemMapper.Map)
            .ToArray();

        return TypedResults.Ok(new ScheduleGroupListResponse(
            items,
            totalCount,
            paging.Skip,
            paging.Take));
    }
}
