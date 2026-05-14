using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using GymCrm.Infrastructure.Persistence;

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

    private static async Task<Results<Ok<ScheduleGroupListResponse>, ValidationProblem>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = GroupRequestValidator.ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = GroupRequestValidator.ResolvePaging(page, pageSize, skip, take);
        var query = TrainingGroupListQuery.CreateBaseQuery(dbContext);
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
