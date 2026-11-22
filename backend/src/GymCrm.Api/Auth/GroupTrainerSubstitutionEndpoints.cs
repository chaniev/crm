using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerSubstitutionEndpoints
{
    public static IEndpointRouteBuilder MapGroupTrainerSubstitutionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup($"{GroupApiConstants.RoutePrefix}/{{groupId:guid}}/trainer-substitutions")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);

        group.MapGet("/", ListLegacyAsync);

        var periods = endpoints
            .MapGroup($"{GroupApiConstants.RoutePrefix}/{{groupId:guid}}/trainer-substitution-periods")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);
        periods.MapGet("/", ListPeriodsAsync);
        GroupTrainerSubstitutionPeriodEndpoints.MapMutations(periods);

        return endpoints;
    }

    private static Task<Results<Ok<GroupTrainerSubstitutionListResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ListLegacyAsync(
        Guid groupId,
        int? historySkip,
        int? historyTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken) =>
        ListAsync(groupId, historySkip, historyTake, httpContext, dbContext, businessDateProvider, cancellationToken, periods: false);

    private static Task<Results<Ok<GroupTrainerSubstitutionListResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ListPeriodsAsync(
        Guid groupId,
        int? historySkip,
        int? historyTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken) =>
        ListAsync(groupId, historySkip, historyTake, httpContext, dbContext, businessDateProvider, cancellationToken, periods: true);

    private static async Task<Results<Ok<GroupTrainerSubstitutionListResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ListAsync(
        Guid groupId,
        int? historySkip,
        int? historyTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken,
        bool periods)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        await using var actorLease = await ClientAccessTransaction.BeginReadAsync(dbContext, currentUser.Id, [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var errors = ValidateHistoryPaging(historySkip, historyTake);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => candidate.Id == groupId)
            .Select(candidate => new { candidate.Id, candidate.BranchId, candidate.IsActive })
            .SingleOrDefaultAsync(cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var today = businessDateProvider.Today;
        var mapped = periods
            ? (await dbContext.GroupTrainerSubstitutionPeriods.AsNoTracking()
                .Include(item => item.SubstituteTrainer)
                .Where(item => item.GroupId == groupId).ToArrayAsync(cancellationToken))
                .Select(item => GroupTrainerSubstitutionPeriodEndpoints.Map(item, item.SubstituteTrainer, today)).ToArray()
            : (await LoadSubstitutionsQuery(dbContext, groupId).ToArrayAsync(cancellationToken))
                .Select(item => Map(item, today)).ToArray();
        var current = mapped
            .Where(item => item.Status is nameof(GroupTrainerSubstitutionStatus.Active) or nameof(GroupTrainerSubstitutionStatus.Upcoming))
            .OrderBy(item => item.Status == nameof(GroupTrainerSubstitutionStatus.Active) ? 0 : 1)
            .ThenBy(item => item.StartsOn)
            .ThenBy(item => item.EndsOn)
            .ThenBy(item => item.Id)
            .ToArray();
        var historyCandidates = mapped
            .Where(item => item.Status is nameof(GroupTrainerSubstitutionStatus.Expired) or nameof(GroupTrainerSubstitutionStatus.Cancelled))
            .OrderByDescending(item => item.StartsOn)
            .ThenByDescending(item => item.EndsOn)
            .ThenByDescending(item => item.Id)
            .ToArray();

        var skip = historySkip ?? 0;
        var take = historyTake ?? GroupApiConstants.DefaultTake;
        return TypedResults.Ok(new GroupTrainerSubstitutionListResponse(
            current,
            new GroupTrainerSubstitutionHistoryResponse(
                historyCandidates.Skip(skip).Take(take).ToArray(),
                historyCandidates.Length,
                skip,
                take),
            group.IsActive,
            group.IsActive
                ? null
                : new GroupTrainerSubstitutionCreateUnavailableReasonResponse(
                    "group_inactive",
                    GroupResources.GroupTrainerSubstitutionCreateUnavailableGroupInactive)));
    }

    private static Dictionary<string, string[]> ValidateHistoryPaging(int? historySkip, int? historyTake)
    {
        var errors = new Dictionary<string, string[]>();
        if (historySkip is < 0)
        {
            errors["historySkip"] = [GroupResources.SkipCannotBeNegative];
        }

        if (historyTake is <= 0 or > GroupApiConstants.MaxTake)
        {
            errors["historyTake"] = [GroupResources.TakeMustBeInRange(GroupApiConstants.MaxTake)];
        }

        return errors;
    }

    private static IQueryable<GroupTrainerSubstitution> LoadSubstitutionsQuery(GymCrmDbContext dbContext, Guid groupId) =>
        dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .Include(substitution => substitution.Group)
                .ThenInclude(group => group.Trainers)
            .Include(substitution => substitution.SubstituteTrainer)
            .Where(substitution => substitution.GroupId == groupId)
            .AsSplitQuery();

    private static GroupTrainerSubstitutionResponse Map(GroupTrainerSubstitution substitution, DateOnly today)
    {
        var status = GroupTrainerSubstitutionPolicy.GetStatus(
            substitution.StartsOn,
            substitution.EndsOn,
            substitution.CancelledAt,
            today);
        var isPermanentTrainer = substitution.Group.Trainers.Any(trainer => trainer.TrainerId == substitution.SubstituteTrainerId);
        var actions = GroupTrainerSubstitutionPolicy.GetAllowedActions(
            status,
            substitution.Group.IsActive,
            isPermanentTrainer);

        return new GroupTrainerSubstitutionResponse(
            substitution.Id,
            substitution.GroupId,
            new GroupTrainerSubstituteResponse(
                substitution.SubstituteTrainerId,
                substitution.SubstituteTrainer.FullName,
                substitution.SubstituteTrainer.Login,
                substitution.SubstituteTrainer.IsActive),
            substitution.StartsOn,
            substitution.EndsOn,
            status.ToString(),
            substitution.CancelledAt,
            substitution.CreatedAt,
            substitution.UpdatedAt,
            new GroupTrainerSubstitutionAllowedActionsResponse(actions.CanEdit, actions.CanCancel));
    }
}
