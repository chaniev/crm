using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class GroupEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGroupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(GroupApiConstants.RoutePrefix)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);

        group.MapGet(GroupApiConstants.ListRoute, ListGroupsAsync);
        group.MapGet(GroupApiConstants.SummaryRoute, GetGroupSummaryAsync);
        group.MapGet(GroupApiConstants.TrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.LegacyTrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.DetailsRoute, GetGroupAsync);
        group.MapGet(GroupApiConstants.ClientsRoute, GetGroupClientsAsync);
        group.MapPost(GroupApiConstants.ListRoute, CreateGroupAsync);
        group.MapPut(GroupApiConstants.DetailsRoute, UpdateGroupAsync);
        group.MapPut(GroupApiConstants.TrainersRoute, UpdateGroupTrainersAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<GroupListResponse>, ValidationProblem, UnauthorizedHttpResult>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? query,
        bool? isActive,
        bool? withoutTrainer,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
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
        var groupsQuery = GroupManagementScope.ApplyTo(TrainingGroupListQuery.CreateBaseQuery(dbContext), currentUser);
        groupsQuery = ApplyListCriteria(groupsQuery, query, isActive, withoutTrainer);
        var totalCount = await groupsQuery.CountAsync(cancellationToken);
        var groups = await TrainingGroupListQuery.LoadPageAsync(groupsQuery, paging, cancellationToken);

        IReadOnlyList<GroupListItemResponse> response = groups
            .Select(TrainingGroupListItemMapper.Map)
            .ToArray();

        return TypedResults.Ok(new GroupListResponse(response, totalCount, paging.Skip, paging.Take));
    }

    private static async Task<Results<Ok<GroupSummaryResponse>, UnauthorizedHttpResult>> GetGroupSummaryAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var query = GroupManagementScope.ApplyTo(dbContext.TrainingGroups.AsNoTracking(), currentUser);
        var totalCount = await query.CountAsync(cancellationToken);
        var activeWithoutTrainerCount = await query
            .CountAsync(trainingGroup => trainingGroup.IsActive && !trainingGroup.Trainers.Any(), cancellationToken);

        return TypedResults.Ok(new GroupSummaryResponse(totalCount, activeWithoutTrainerCount));
    }

    private static async Task<Ok<IReadOnlyList<TrainerOptionResponse>>> ListTrainerOptionsAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<TrainerOptionResponse> trainers = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.IsActive && GroupTrainerEligibility.AssignableRoles.Contains(user.Role))
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new TrainerOptionResponse(
                user.Id,
                user.FullName,
                user.Login))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(trainers);
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetGroupAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupSnapshotAsync(id, dbContext, cancellationToken);
        if (group is not null && !GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        return group is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapDetails(group));
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupClientResponse>>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetGroupClientsAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var groupBranchId = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => group.Id == id)
            .Select(group => (Guid?)group.BranchId)
            .SingleOrDefaultAsync(cancellationToken);

        if (!groupBranchId.HasValue)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, groupBranchId.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var clients = await dbContext.ClientGroups
            .AsNoTracking()
            .Where(clientGroup => clientGroup.GroupId == id)
            .Select(clientGroup => new GroupClientProjection(
                clientGroup.Client.Id,
                clientGroup.Client.LastName,
                clientGroup.Client.FirstName,
                clientGroup.Client.MiddleName,
                clientGroup.Client.Status.ToString()))
            .ToListAsync(cancellationToken);

        IReadOnlyList<GroupClientResponse> response = clients
            .OrderBy(client => client.LastName, StringComparer.CurrentCulture)
            .ThenBy(client => client.FirstName, StringComparer.CurrentCulture)
            .ThenBy(client => client.MiddleName, StringComparer.CurrentCulture)
            .ThenBy(client => client.Id)
            .Select(client => new GroupClientResponse(
                client.Id,
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                client.Status))
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static async Task<Results<Created<GroupDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateGroupAsync(
        UpsertTrainingGroupRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
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

        var normalizedRequest = GroupRequestValidator.NormalizeRequest(request);
        var validationErrors = await GroupRequestValidator.ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        if (!GroupManagementScope.Contains(currentUser, normalizedRequest.BranchId!.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var trainingStartTime = GroupRequestValidator.ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;
        var now = DateTimeOffset.UtcNow;

        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = normalizedRequest.BranchId!.Value,
            HallId = normalizedRequest.HallId!.Value,
            GroupTypeId = normalizedRequest.GroupTypeId!.Value,
            Name = normalizedRequest.Name,
            TrainingStartTime = trainingStartTime.Value,
            DurationMinutes = normalizedRequest.DurationMinutes!.Value,
            Weekdays = normalizedRequest.Weekdays,
            IsActive = normalizedRequest.IsActive ?? true,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var trainerId in normalizedRequest.TrainerIds)
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
            group.TrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = trainerId,
                ValidFrom = DateOnly.FromDateTime(now.UtcDateTime.Date),
                CreatedByUserId = currentUser.Id,
                CreatedAt = now
            });
        }

        dbContext.TrainingGroups.Add(group);
        await dbContext.SaveChangesAsync(cancellationToken);

        var createdGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created training group '{group.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupAuditConstants.TrainingGroupCreatedAction,
                GroupAuditConstants.TrainingGroupEntityType,
                group.Id.ToString(),
                GroupResources.TrainingGroupCreatedDescription(currentUser.Login, group.Name),
                NewValueJson: SerializeAuditState(createdGroup)),
            cancellationToken);

        return TypedResults.Created($"{GroupApiConstants.RoutePrefix}/{group.Id}", MapDetails(createdGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupAsync(
        Guid id,
        UpsertTrainingGroupRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
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

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var normalizedRequest = GroupRequestValidator.NormalizeRequest(request);
        var validationErrors = await GroupRequestValidator.ValidateUpsertRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            group.Id);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        if (!GroupManagementScope.Contains(currentUser, normalizedRequest.BranchId!.Value))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var oldState = SerializeAuditState(group);
        var trainingStartTime = GroupRequestValidator.ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;

        group.Name = normalizedRequest.Name;
        group.BranchId = normalizedRequest.BranchId!.Value;
        group.HallId = normalizedRequest.HallId!.Value;
        group.GroupTypeId = normalizedRequest.GroupTypeId!.Value;
        group.TrainingStartTime = trainingStartTime.Value;
        group.DurationMinutes = normalizedRequest.DurationMinutes!.Value;
        group.Weekdays = normalizedRequest.Weekdays;
        group.IsActive = normalizedRequest.IsActive ?? group.IsActive;
        group.UpdatedAt = DateTimeOffset.UtcNow;

        ApplyTrainerAssignments(group, normalizedRequest.TrainerIds, currentUser.Id, DateTimeOffset.UtcNow, dbContext);

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated training group '{group.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupAuditConstants.TrainingGroupUpdatedAction,
                GroupAuditConstants.TrainingGroupEntityType,
                group.Id.ToString(),
                GroupResources.TrainingGroupUpdatedDescription(currentUser.Login, group.Name),
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupTrainersAsync(
        Guid id,
        UpdateGroupTrainersRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
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

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var normalizedTrainerIds = GroupRequestValidator.NormalizeTrainerIds(request.TrainerIds);
        var validationErrors = await GroupRequestValidator.ValidateTrainerIdsAsync(request.TrainerIds, normalizedTrainerIds, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(group);

        var now = DateTimeOffset.UtcNow;
        ApplyTrainerAssignments(group, normalizedTrainerIds, currentUser.Id, now, dbContext);
        group.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedGroup = await LoadGroupSnapshotAsync(group.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated training group '{group.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupAuditConstants.TrainingGroupUpdatedAction,
                GroupAuditConstants.TrainingGroupEntityType,
                group.Id.ToString(),
                GroupResources.TrainingGroupTrainersUpdatedDescription(currentUser.Login, group.Name),
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<TrainingGroup?> LoadGroupSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .AsNoTracking()
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.GroupType)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static async Task<TrainingGroup?> LoadGroupForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .Include(group => group.Branch)
            .Include(group => group.Hall)
            .Include(group => group.GroupType)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static IQueryable<TrainingGroup> ApplyListCriteria(
        IQueryable<TrainingGroup> query,
        string? searchQuery,
        bool? isActive,
        bool? withoutTrainer)
    {
        var normalizedQuery = searchQuery?.Trim();
        if (!string.IsNullOrEmpty(normalizedQuery))
        {
            var loweredQuery = normalizedQuery.ToLower();
            query = query.Where(group => group.Name.ToLower().Contains(loweredQuery));
        }

        if (isActive.HasValue)
        {
            query = query.Where(group => group.IsActive == isActive.Value);
        }

        if (withoutTrainer == true)
        {
            query = query.Where(group => !group.Trainers.Any());
        }

        return query;
    }
    private static void ApplyTrainerAssignments(
        TrainingGroup group,
        IReadOnlyList<Guid> requestedTrainerIds,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        var requested = requestedTrainerIds.ToHashSet();
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);

        var trainersToRemove = group.Trainers
            .Where(groupTrainer => !requested.Contains(groupTrainer.TrainerId))
            .ToArray();
        var assignmentsToClose = group.TrainerAssignments
            .Where(assignment => assignment.ValidTo == null && !requested.Contains(assignment.TrainerId))
            .ToArray();

        dbContext.GroupTrainers.RemoveRange(trainersToRemove);

        foreach (var trainerToRemove in trainersToRemove)
        {
            group.Trainers.Remove(trainerToRemove);
        }

        foreach (var assignment in assignmentsToClose)
        {
            CloseOrRemoveTrainerAssignment(assignment, today, dbContext.GroupTrainerAssignments);
        }

        var existingTrainerIds = group.Trainers
            .Select(groupTrainer => groupTrainer.TrainerId)
            .ToHashSet();
        var activeAssignmentTrainerIds = group.TrainerAssignments
            .Where(assignment => assignment.ValidTo == null && requested.Contains(assignment.TrainerId))
            .Select(assignment => assignment.TrainerId)
            .ToHashSet();

        foreach (var trainerId in requested.Where(trainerId => !existingTrainerIds.Contains(trainerId)))
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
        }

        foreach (var trainerId in requested.Where(trainerId => !activeAssignmentTrainerIds.Contains(trainerId)))
        {
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = trainerId,
                ValidFrom = today,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            });
        }
    }

    private static void CloseOrRemoveTrainerAssignment(
        GroupTrainerAssignment assignment,
        DateOnly validTo,
        DbSet<GroupTrainerAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }

    private static GroupDetailsResponse MapDetails(TrainingGroup group)
    {
        var trainers = group.Trainers
            .Select(groupTrainer => groupTrainer.Trainer)
            .OrderBy(trainer => trainer.FullName, StringComparer.CurrentCulture)
            .ThenBy(trainer => trainer.Login, StringComparer.CurrentCulture)
            .Select(trainer => new TrainerSummaryResponse(
                trainer.Id,
                trainer.FullName,
                trainer.Login))
            .ToArray();

        return new GroupDetailsResponse(
            group.Id,
            group.Name,
            group.BranchId,
            group.Branch.Name,
            group.HallId,
            group.Hall.Name,
            group.GroupTypeId,
            group.GroupType.Name,
            FormatTrainingStartTime(group.TrainingStartTime),
            group.DurationMinutes,
            SortWeekdays(group.Weekdays),
            group.IsActive,
            trainers.Select(trainer => trainer.Id).ToArray(),
            trainers,
            group.Clients.Count,
            group.UpdatedAt);
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? ClientResources.ClientWithoutName
            : fullName;
    }

    private static string FormatTrainingStartTime(TimeOnly trainingStartTime)
    {
        return trainingStartTime.ToString("HH':'mm", CultureInfo.InvariantCulture);
    }

    private static string SerializeAuditState(TrainingGroup group)
    {
        return JsonSerializer.Serialize(
            new TrainingGroupAuditState(
                group.Id,
                group.Name,
                group.BranchId,
                group.HallId,
                group.GroupTypeId,
                FormatTrainingStartTime(group.TrainingStartTime),
                group.DurationMinutes,
                SortWeekdays(group.Weekdays),
                group.IsActive,
                group.Trainers
                    .Select(groupTrainer => groupTrainer.TrainerId)
                    .OrderBy(trainerId => trainerId)
                    .ToArray(),
                group.Clients.Count,
                group.UpdatedAt),
            AuditSerializerOptions);
    }

    private static int[] SortWeekdays(IEnumerable<int> weekdays)
    {
        return weekdays
            .OrderBy(weekday => weekday)
            .ToArray();
    }
}
