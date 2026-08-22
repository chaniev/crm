using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerSubstitutionEndpoints
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string OverlapProblemType = "/problems/group-trainer-substitution-overlap";
    private const string OverlapProblemCode = "group_trainer_substitution_overlap";
    private const string NoChangesProblemType = "/problems/group-trainer-substitution-no-changes";
    private const string NoChangesProblemCode = "group_trainer_substitution_no_changes";
    private const string ImmutableProblemType = "/problems/group-trainer-substitution-immutable";
    private const string ImmutableProblemCode = "group_trainer_substitution_immutable";
    private const string ActiveEditConflictProblemType = "/problems/group-trainer-substitution-active-edit-conflict";
    private const string ActiveEditConflictProblemCode = "group_trainer_substitution_active_edit_conflict";
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGroupTrainerSubstitutionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup($"{GroupApiConstants.RoutePrefix}/{{groupId:guid}}/trainer-substitutions")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);

        group.MapGet("/", ListAsync);
        group.MapPost("/", CreateAsync);
        group.MapPut("/{substitutionId:guid}", UpdateAsync);
        group.MapPost("/{substitutionId:guid}/cancel", CancelAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<GroupTrainerSubstitutionListResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ListAsync(
        Guid groupId,
        int? historySkip,
        int? historyTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
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
        var substitutions = await LoadSubstitutionsQuery(dbContext, groupId)
            .ToArrayAsync(cancellationToken);
        var mapped = substitutions
            .Select(substitution => Map(substitution, today))
            .ToArray();
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

        var groupBranchId = await LoadGroupBranchIdAsync(groupId, dbContext, cancellationToken);
        if (!groupBranchId.HasValue)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, groupBranchId.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateCreateAsync(groupId, request, dbContext, businessDateProvider.Today, cancellationToken);
        if (parsed.NotFound)
        {
            return TypedResults.NotFound();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        if (await HasOverlapAsync(groupId, null, parsed.SubstituteTrainerId!.Value, parsed.StartsOn!.Value, parsed.EndsOn!.Value, dbContext, cancellationToken))
        {
            return CreateOverlapProblem();
        }

        var now = DateTimeOffset.UtcNow;
        var substitution = new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = parsed.SubstituteTrainerId.Value,
            StartsOn = parsed.StartsOn.Value,
            EndsOn = parsed.EndsOn.Value,
            CreatedByUserId = currentUser.Id,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        try
        {
            dbContext.GroupTrainerSubstitutions.Add(substitution);
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.GroupTrainerSubstitutionCreatedAction,
                    GroupAuditConstants.GroupTrainerSubstitutionEntityType,
                    substitution.Id.ToString(),
                    $"Пользователь '{currentUser.Login}' создал замещение тренера группы.",
                    NewValueJson: SerializeAuditState(substitution)),
                cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (Exception exception) when (IsSubstitutionOverlapException(exception))
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return CreateOverlapProblem();
        }

        var created = await LoadSubstitutionAsync(groupId, substitution.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created substitution '{substitution.Id}' was not found.");
        return TypedResults.Created(
            $"{GroupApiConstants.RoutePrefix}/{groupId}/trainer-substitutions/{substitution.Id}",
            Map(created, businessDateProvider.Today));
    }

    private static async Task<Results<Ok<GroupTrainerSubstitutionResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult, NotFound>> UpdateAsync(
        Guid groupId,
        Guid substitutionId,
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

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
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

        if (substitution.Group.Trainers.Any(trainer => trainer.TrainerId == substitution.SubstituteTrainerId))
        {
            return CreateImmutableProblem();
        }

        if (!substitution.Group.IsActive)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["groupId"] = ["Группа должна быть активной."] });
        }

        var parsed = await ValidateRequestAsync(groupId, request, dbContext, today, isCreate: false, cancellationToken);
        if (parsed.NotFound)
        {
            return TypedResults.NotFound();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        if (status == GroupTrainerSubstitutionStatus.Upcoming && parsed.StartsOn!.Value < today)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["startsOn"] = ["Дата начала должна быть сегодня или позже."] });
        }

        if (status == GroupTrainerSubstitutionStatus.Active &&
            (parsed.SubstituteTrainerId != substitution.SubstituteTrainerId || parsed.StartsOn != substitution.StartsOn || parsed.EndsOn < today))
        {
            return CreateConflictProblem(
                ActiveEditConflictProblemType,
                ActiveEditConflictProblemCode,
                GroupResources.GroupTrainerSubstitutionActiveEditConflictTitle,
                GroupResources.GroupTrainerSubstitutionActiveEditConflictDetail);
        }

        if (substitution.SubstituteTrainerId == parsed.SubstituteTrainerId &&
            substitution.StartsOn == parsed.StartsOn &&
            substitution.EndsOn == parsed.EndsOn)
        {
            return CreateConflictProblem(
                NoChangesProblemType,
                NoChangesProblemCode,
                GroupResources.GroupTrainerSubstitutionNoChangesTitle,
                GroupResources.GroupTrainerSubstitutionNoChangesDetail);
        }

        if (await HasOverlapAsync(
                groupId,
                substitution.Id,
                parsed.SubstituteTrainerId!.Value,
                parsed.StartsOn!.Value,
                parsed.EndsOn!.Value,
                dbContext,
                cancellationToken))
        {
            return CreateOverlapProblem();
        }

        var oldState = SerializeAuditState(substitution);
        substitution.SubstituteTrainerId = parsed.SubstituteTrainerId.Value;
        substitution.StartsOn = parsed.StartsOn.Value;
        substitution.EndsOn = parsed.EndsOn.Value;
        substitution.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.GroupTrainerSubstitutionUpdatedAction,
                    GroupAuditConstants.GroupTrainerSubstitutionEntityType,
                    substitution.Id.ToString(),
                    $"Пользователь '{currentUser.Login}' изменил замещение тренера группы.",
                    oldState,
                    SerializeAuditState(substitution)),
                cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (Exception exception) when (IsSubstitutionOverlapException(exception))
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return CreateOverlapProblem();
        }
        catch (DbUpdateConcurrencyException)
        {
            return CreateImmutableProblem();
        }

        var updated = await LoadSubstitutionAsync(groupId, substitutionId, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated substitution '{substitutionId}' was not found.");
        return TypedResults.Ok(Map(updated, today));
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

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
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
        substitution.UpdatedAt = now;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.GroupTrainerSubstitutionCancelledAction,
                    GroupAuditConstants.GroupTrainerSubstitutionEntityType,
                    substitution.Id.ToString(),
                    $"Пользователь '{currentUser.Login}' отменил замещение тренера группы.",
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

        var cancelled = await LoadSubstitutionAsync(groupId, substitutionId, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Cancelled substitution '{substitutionId}' was not found.");
        return TypedResults.Ok(Map(cancelled, today));
    }

    private static async Task<ParsedSubstitutionRequest> ValidateCreateAsync(
        Guid groupId,
        UpsertGroupTrainerSubstitutionRequest request,
        GymCrmDbContext dbContext,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        var parsed = await ValidateRequestAsync(groupId, request, dbContext, today, isCreate: true, cancellationToken);
        if (!parsed.NotFound && parsed.Errors.Count == 0 && parsed.StartsOn!.Value < today)
        {
            parsed.Errors["startsOn"] = ["Дата начала должна быть сегодня или позже."];
        }

        return parsed;
    }

    private static async Task<ParsedSubstitutionRequest> ValidateRequestAsync(
        Guid groupId,
        UpsertGroupTrainerSubstitutionRequest request,
        GymCrmDbContext dbContext,
        DateOnly today,
        bool isCreate,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => candidate.Id == groupId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IsActive,
                MainTrainerIds = candidate.Trainers.Select(trainer => trainer.TrainerId).ToArray()
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (group is null)
        {
            return new ParsedSubstitutionRequest(true, null, null, null, errors);
        }

        if (isCreate && !group.IsActive)
        {
            errors["groupId"] = ["Группа должна быть активной."];
        }

        var substituteTrainerId = request.SubstituteTrainerId;
        if (!substituteTrainerId.HasValue || substituteTrainerId.Value == Guid.Empty)
        {
            errors["substituteTrainerId"] = ["Укажите замещающего тренера."];
        }
        else
        {
            var trainer = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.Id == substituteTrainerId.Value)
                .Select(user => new { user.IsActive, user.Role })
                .SingleOrDefaultAsync(cancellationToken);
            if (trainer is null || !trainer.IsActive || !GroupTrainerEligibility.AssignableRoles.Contains(trainer.Role))
            {
                errors["substituteTrainerId"] = ["Замещающий тренер должен быть активным тренером или главным тренером."];
            }
            else if (group.MainTrainerIds.Contains(substituteTrainerId.Value))
            {
                errors["substituteTrainerId"] = ["Основной тренер этой группы не может быть выбран замещающим."];
            }
        }

        var startsOn = ParseDate(request.StartsOn);
        if (!startsOn.HasValue)
        {
            errors["startsOn"] = ["Укажите дату начала в формате yyyy-MM-dd."];
        }

        var endsOn = ParseDate(request.EndsOn);
        if (!endsOn.HasValue)
        {
            errors["endsOn"] = ["Укажите дату окончания в формате yyyy-MM-dd."];
        }

        if (startsOn.HasValue && endsOn.HasValue && endsOn.Value < startsOn.Value)
        {
            errors["endsOn"] = ["Дата окончания не может быть раньше даты начала."];
        }

        return new ParsedSubstitutionRequest(false, substituteTrainerId, startsOn, endsOn, errors);
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

    private static async Task<Guid?> LoadGroupBranchIdAsync(
        Guid groupId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => group.Id == groupId)
            .Select(group => (Guid?)group.BranchId)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static IQueryable<GroupTrainerSubstitution> LoadSubstitutionsQuery(GymCrmDbContext dbContext, Guid groupId) =>
        dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .Include(substitution => substitution.Group)
                .ThenInclude(group => group.Trainers)
            .Include(substitution => substitution.SubstituteTrainer)
            .Where(substitution => substitution.GroupId == groupId)
            .AsSplitQuery();

    private static async Task<GroupTrainerSubstitution?> LoadSubstitutionAsync(
        Guid groupId,
        Guid substitutionId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken) =>
        await LoadSubstitutionsQuery(dbContext, groupId)
            .SingleOrDefaultAsync(substitution => substitution.Id == substitutionId, cancellationToken);

    private static async Task<GroupTrainerSubstitution?> LoadMutableSubstitutionAsync(
        Guid groupId,
        Guid substitutionId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.GroupTrainerSubstitutions
            .Include(item => item.Group)
                .ThenInclude(group => group.Trainers)
            .Include(item => item.SubstituteTrainer)
            .AsSplitQuery()
            .SingleOrDefaultAsync(item => item.GroupId == groupId && item.Id == substitutionId, cancellationToken);

    private static async Task<bool> HasOverlapAsync(
        Guid groupId,
        Guid? exceptSubstitutionId,
        Guid substituteTrainerId,
        DateOnly startsOn,
        DateOnly endsOn,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .AnyAsync(
                substitution =>
                    substitution.GroupId == groupId &&
                    substitution.SubstituteTrainerId == substituteTrainerId &&
                    substitution.CancelledAt == null &&
                    (!exceptSubstitutionId.HasValue || substitution.Id != exceptSubstitutionId.Value) &&
                    substitution.StartsOn <= endsOn &&
                    startsOn <= substitution.EndsOn,
                cancellationToken);

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
                ["startsOn"] = ["Период пересекается с другим замещением этого тренера."],
                ["endsOn"] = ["Период пересекается с другим замещением этого тренера."]
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

    private static bool IsSubstitutionOverlapException(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is not DbUpdateException dbUpdateException)
            {
                continue;
            }

            var postgresException = FindPostgresException(dbUpdateException);
            if (postgresException is null)
            {
                continue;
            }

            if (IsSubstitutionExclusionViolation(postgresException) ||
                IsSubstitutionExclusionDeadlock(dbUpdateException, postgresException))
            {
                return true;
            }
        }

        return false;
    }

    private static PostgresException? FindPostgresException(Exception exception)
    {
        for (var current = exception.InnerException; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgresException)
            {
                return postgresException;
            }
        }

        return null;
    }

    private static bool IsSubstitutionExclusionViolation(PostgresException postgresException) =>
        string.Equals(postgresException.SqlState, PostgresErrorCodes.ExclusionViolation, StringComparison.Ordinal) &&
        string.Equals(
            postgresException.ConstraintName,
            "EX_GroupTrainerSubstitutions_GroupTrainer_Period_NoOverlap",
            StringComparison.Ordinal);

    private static bool IsSubstitutionExclusionDeadlock(
        DbUpdateException dbUpdateException,
        PostgresException postgresException) =>
        string.Equals(postgresException.SqlState, PostgresErrorCodes.DeadlockDetected, StringComparison.Ordinal) &&
        dbUpdateException.Entries.Any(entry => entry.Entity is GroupTrainerSubstitution) &&
        (string.Equals(postgresException.TableName, "GroupTrainerSubstitutions", StringComparison.Ordinal) ||
            (postgresException.Where?.Contains("GroupTrainerSubstitutions", StringComparison.Ordinal) ?? false));

    private static async Task<IDbContextTransaction?> BeginTransactionIfSupportedAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        return providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase)
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private static string SerializeAuditState(GroupTrainerSubstitution substitution)
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
        bool NotFound,
        Guid? SubstituteTrainerId,
        DateOnly? StartsOn,
        DateOnly? EndsOn,
        Dictionary<string, string[]> Errors);
}
