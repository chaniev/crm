using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerSubstitutionPeriodEndpoints
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string OverlapProblemType = "/problems/group-trainer-substitution-overlap";
    private const string OverlapProblemCode = "group_trainer_substitution_overlap";
    private const string ImmutableProblemType = "/problems/group-trainer-substitution-immutable";
    private const string ImmutableProblemCode = "group_trainer_substitution_immutable";
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    internal static void MapMutations(RouteGroupBuilder periods)
    {
        periods.MapPost("/", CreateAsync);
        periods.MapPost("/{substitutionId:guid}/cancel", CancelAsync);
    }

    private static async Task<Results<Created<GroupTrainerSubstitutionResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult, NotFound>> CreateAsync(
        Guid groupId,
        UpsertGroupTrainerSubstitutionRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(
            dbContext, currentUser.Id, null, [groupId], [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await dbContext.TrainingGroups.AsNoTracking()
            .Where(item => item.Id == groupId)
            .Select(item => new
            {
                item.IsActive,
                item.BranchId,
                MainTrainerIds = item.Trainers.Select(link => link.TrainerId).ToArray()
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateCreateAsync(group.IsActive, group.MainTrainerIds, request, dbContext, businessDateProvider.Today, cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        if (await HasOverlapAsync(groupId, parsed.Trainer!.Id, parsed.StartsOn!.Value, parsed.EndsOn!.Value, dbContext, cancellationToken))
        {
            return CreateOverlapProblem();
        }

        var now = DateTimeOffset.UtcNow;
        var substitution = new GroupTrainerSubstitutionPeriod
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = parsed.Trainer.Id,
            StartsOn = parsed.StartsOn.Value,
            EndsOn = parsed.EndsOn.Value,
            CreatedByUserId = currentUser.Id,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            dbContext.GroupTrainerSubstitutionPeriods.Add(substitution);
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.GroupTrainerSubstitutionPeriodCreatedAction,
                    GroupAuditConstants.GroupTrainerSubstitutionPeriodEntityType,
                    substitution.Id.ToString(),
                    global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine1867e830ea8(currentUser.Login),
                    NewValueJson: SerializeAuditState(substitution)),
                cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (DbUpdateException exception) when (IsSubstitutionOverlapException(exception))
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return CreateOverlapProblem();
        }

        return TypedResults.Created((string?)null, Map(substitution, parsed.Trainer, businessDateProvider.Today));
    }

    private static async Task<Results<Ok<GroupTrainerSubstitutionResponse>, ProblemHttpResult, UnauthorizedHttpResult, NotFound>> CancelAsync(
        Guid groupId,
        Guid substitutionId,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(
            dbContext, currentUser.Id, null, [groupId], [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var substitution = await LoadMutableSubstitutionAsync(groupId, substitutionId, dbContext, cancellationToken);
        if (substitution is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, substitution.Group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var today = businessDateProvider.Today;
        var status = GroupTrainerSubstitutionPolicy.GetStatus(
            substitution.StartsOn,
            substitution.EndsOn,
            substitution.CancelledAt,
            today);
        if (status is GroupTrainerSubstitutionStatus.Cancelled or GroupTrainerSubstitutionStatus.Expired)
        {
            return CreateImmutableProblem();
        }

        var oldState = SerializeAuditState(substitution);
        var now = DateTimeOffset.UtcNow;
        substitution.CancelledAt = now;
        substitution.CancelledByUserId = currentUser.Id;
        substitution.UpdatedAt = now;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.GroupTrainerSubstitutionPeriodCancelledAction,
                    GroupAuditConstants.GroupTrainerSubstitutionPeriodEntityType,
                    substitution.Id.ToString(),
                    global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine41840f3e7c0(currentUser.Login),
                    oldState,
                    SerializeAuditState(substitution)),
                cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            return CreateImmutableProblem();
        }

        return TypedResults.Ok(Map(substitution, substitution.SubstituteTrainer, today));
    }

    private static async Task<ParsedSubstitutionRequest> ValidateCreateAsync(
        bool groupIsActive,
        Guid[] mainTrainerIds,
        UpsertGroupTrainerSubstitutionRequest request,
        GymCrmDbContext dbContext,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (!groupIsActive)
        {
            errors["groupId"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine4791d60c817];
        }

        var substituteTrainerId = request.SubstituteTrainerId;
        User? trainer = null;
        if (!substituteTrainerId.HasValue || substituteTrainerId.Value == Guid.Empty)
        {
            errors["substituteTrainerId"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine485688b34f5];
        }
        else
        {
            trainer = await dbContext.Users
                .AsNoTracking()
                .SingleOrDefaultAsync(user => user.Id == substituteTrainerId.Value, cancellationToken);
            if (trainer is null || !trainer.IsActive || !GroupTrainerEligibility.AssignableRoles.Contains(trainer.Role))
            {
                errors["substituteTrainerId"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine496C99d3372];
            }
            else if (mainTrainerIds.Contains(substituteTrainerId.Value))
            {
                errors["substituteTrainerId"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine500F66e630f];
            }
        }

        var startsOn = ParseDate(request.StartsOn);
        if (!startsOn.HasValue)
        {
            errors["startsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine50783c61e4f];
        }
        else if (startsOn.Value < today)
        {
            errors["startsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine44780144680];
        }

        var endsOn = ParseDate(request.EndsOn);
        if (!endsOn.HasValue)
        {
            errors["endsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine513Df370b9a];
        }

        if (startsOn.HasValue && endsOn.HasValue && endsOn.Value < startsOn.Value)
        {
            errors["endsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine518De43f4f3];
        }

        return new ParsedSubstitutionRequest(trainer, startsOn, endsOn, errors);
    }

    private static async Task<GroupTrainerSubstitutionPeriod?> LoadMutableSubstitutionAsync(
        Guid groupId,
        Guid substitutionId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.GroupTrainerSubstitutionPeriods
            .Include(item => item.Group)
            .Include(item => item.SubstituteTrainer)
            .SingleOrDefaultAsync(item => item.GroupId == groupId && item.Id == substitutionId, cancellationToken);

    private static async Task<bool> HasOverlapAsync(
        Guid groupId,
        Guid substituteTrainerId,
        DateOnly startsOn,
        DateOnly endsOn,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.GroupTrainerSubstitutionPeriods
            .AsNoTracking()
            .AnyAsync(
                substitution =>
                    substitution.GroupId == groupId &&
                    substitution.SubstituteTrainerId == substituteTrainerId &&
                    substitution.CancelledAt == null &&
                    substitution.StartsOn <= endsOn &&
                    startsOn <= substitution.EndsOn,
                cancellationToken);

    internal static GroupTrainerSubstitutionResponse Map(GroupTrainerSubstitutionPeriod substitution, User trainer, DateOnly today)
    {
        var status = GroupTrainerSubstitutionPolicy.GetStatus(
            substitution.StartsOn,
            substitution.EndsOn,
            substitution.CancelledAt,
            today);
        return new GroupTrainerSubstitutionResponse(
            substitution.Id,
            substitution.GroupId,
            new GroupTrainerSubstituteResponse(
                substitution.SubstituteTrainerId,
                trainer.FullName,
                trainer.Login,
                trainer.IsActive),
            substitution.StartsOn,
            substitution.EndsOn,
            status.ToString(),
            substitution.CancelledAt,
            substitution.CreatedAt,
            substitution.UpdatedAt,
            new GroupTrainerSubstitutionAllowedActionsResponse(false, status is GroupTrainerSubstitutionStatus.Active or GroupTrainerSubstitutionStatus.Upcoming));
    }

    private static DateOnly? ParseDate(string? value) =>
        DateOnly.TryParseExact(
            value?.Trim(),
            DateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;

    private static ProblemHttpResult CreateOverlapProblem() =>
        CreateConflictProblem(
            OverlapProblemType,
            OverlapProblemCode,
            GroupResources.GroupTrainerSubstitutionOverlapTitle,
            GroupResources.GroupTrainerSubstitutionOverlapDetail,
            new Dictionary<string, string[]>
            {
                ["startsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine6495ee85073],
                ["endsOn"] = [global::GymCrm.Api.UserFacingText.BE5GroupsText.GroupTrainerSubstitutionEndpointsLine6505ee85073]
            });

    private static ProblemHttpResult CreateImmutableProblem() =>
        CreateConflictProblem(
            ImmutableProblemType,
            ImmutableProblemCode,
            GroupResources.GroupTrainerSubstitutionImmutableTitle,
            GroupResources.GroupTrainerSubstitutionImmutableDetail);

    private static ProblemHttpResult CreateConflictProblem(
        string type,
        string code,
        string title,
        string detail,
        Dictionary<string, string[]>? errors = null)
    {
        return TypedResults.Problem(new HttpValidationProblemDetails(errors ?? new Dictionary<string, string[]>())
        {
            Status = StatusCodes.Status409Conflict,
            Type = type,
            Title = title,
            Detail = detail,
            Extensions = { ["code"] = code }
        });
    }

    private static bool IsSubstitutionOverlapException(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.ExclusionViolation,
            ConstraintName: "EX_GroupTrainerSubstitutionPeriods_Pair_NoOverlap"
        };

    private static string SerializeAuditState(GroupTrainerSubstitutionPeriod substitution)
    {
        return JsonSerializer.Serialize(
            new GroupTrainerSubstitutionAuditState(
                substitution.Id,
                substitution.GroupId,
                substitution.SubstituteTrainerId,
                substitution.StartsOn,
                substitution.EndsOn,
                substitution.CancelledAt,
                substitution.CreatedAt,
                substitution.UpdatedAt),
            AuditSerializerOptions);
    }

    private sealed record ParsedSubstitutionRequest(
        User? Trainer,
        DateOnly? StartsOn,
        DateOnly? EndsOn,
        Dictionary<string, string[]> Errors);
}
