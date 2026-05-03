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
        group.MapGet(GroupApiConstants.TrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.LegacyTrainerOptionsRoute, ListTrainerOptionsAsync);
        group.MapGet(GroupApiConstants.DetailsRoute, GetGroupAsync);
        group.MapGet(GroupApiConstants.ClientsRoute, GetGroupClientsAsync);
        group.MapPost(GroupApiConstants.ListRoute, CreateGroupAsync);
        group.MapPut(GroupApiConstants.DetailsRoute, UpdateGroupAsync);
        group.MapPut(GroupApiConstants.TrainersRoute, UpdateGroupTrainersAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupListItemResponse>>, ValidationProblem>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        bool? isActive,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = GroupRequestValidator.ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = GroupRequestValidator.ResolvePaging(page, pageSize, skip, take);

        var query = dbContext.TrainingGroups.AsNoTracking();
        if (isActive.HasValue)
        {
            query = query.Where(group => group.IsActive == isActive.Value);
        }

        var groups = await query
            .OrderBy(group => group.Name)
            .ThenBy(group => group.TrainingStartTime)
            .ThenBy(group => group.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        IReadOnlyList<GroupListItemResponse> response = groups
            .Select(MapListItem)
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static async Task<Ok<IReadOnlyList<TrainerOptionResponse>>> ListTrainerOptionsAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<TrainerOptionResponse> trainers = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.IsActive && user.Role == UserRole.Coach)
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new TrainerOptionResponse(
                user.Id,
                user.FullName,
                user.Login))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(trainers);
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound>> GetGroupAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var group = await LoadGroupSnapshotAsync(id, dbContext, cancellationToken);

        return group is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapDetails(group));
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupClientResponse>>, NotFound>> GetGroupClientsAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var groupExists = await dbContext.TrainingGroups
            .AsNoTracking()
            .AnyAsync(group => group.Id == id, cancellationToken);

        if (!groupExists)
        {
            return TypedResults.NotFound();
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

        var trainingStartTime = GroupRequestValidator.ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;
        var now = DateTimeOffset.UtcNow;

        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = normalizedRequest.Name,
            TrainingStartTime = trainingStartTime.Value,
            ScheduleText = normalizedRequest.ScheduleText,
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

        var normalizedRequest = GroupRequestValidator.NormalizeRequest(request);
        var validationErrors = await GroupRequestValidator.ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(group);
        var trainingStartTime = GroupRequestValidator.ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;

        group.Name = normalizedRequest.Name;
        group.TrainingStartTime = trainingStartTime.Value;
        group.ScheduleText = normalizedRequest.ScheduleText;
        group.IsActive = normalizedRequest.IsActive ?? group.IsActive;
        group.UpdatedAt = DateTimeOffset.UtcNow;

        ApplyTrainerAssignments(group, normalizedRequest.TrainerIds, dbContext);

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

        var normalizedTrainerIds = GroupRequestValidator.NormalizeTrainerIds(request.TrainerIds);
        var validationErrors = await GroupRequestValidator.ValidateTrainerIdsAsync(request.TrainerIds, normalizedTrainerIds, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(group);

        ApplyTrainerAssignments(group, normalizedTrainerIds, dbContext);
        group.UpdatedAt = DateTimeOffset.UtcNow;

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
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
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
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static void ApplyTrainerAssignments(
        TrainingGroup group,
        IReadOnlyList<Guid> requestedTrainerIds,
        GymCrmDbContext dbContext)
    {
        var requested = requestedTrainerIds.ToHashSet();

        var trainersToRemove = group.Trainers
            .Where(groupTrainer => !requested.Contains(groupTrainer.TrainerId))
            .ToArray();

        dbContext.GroupTrainers.RemoveRange(trainersToRemove);

        foreach (var trainerToRemove in trainersToRemove)
        {
            group.Trainers.Remove(trainerToRemove);
        }

        var existingTrainerIds = group.Trainers
            .Select(groupTrainer => groupTrainer.TrainerId)
            .ToHashSet();

        foreach (var trainerId in requested.Where(trainerId => !existingTrainerIds.Contains(trainerId)))
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
        }
    }

    private static GroupListItemResponse MapListItem(TrainingGroup group)
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

        return new GroupListItemResponse(
            group.Id,
            group.Name,
            FormatTrainingStartTime(group.TrainingStartTime),
            group.ScheduleText,
            group.IsActive,
            trainers,
            trainers.Select(trainer => trainer.Id).ToArray(),
            trainers.Length,
            trainers.Select(trainer => trainer.FullName).ToArray(),
            group.Clients.Count,
            group.UpdatedAt);
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
            FormatTrainingStartTime(group.TrainingStartTime),
            group.ScheduleText,
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
                FormatTrainingStartTime(group.TrainingStartTime),
                group.ScheduleText,
                group.IsActive,
                group.Trainers
                    .Select(groupTrainer => groupTrainer.TrainerId)
                    .OrderBy(trainerId => trainerId)
                    .ToArray(),
                group.Clients.Count,
                group.UpdatedAt),
            AuditSerializerOptions);
    }
}
