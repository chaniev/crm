using System.Globalization;
using System.Text.Json;
using Crm.Application.Audit;
using Crm.Domain.Groups;
using Crm.Domain.Users;
using Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Crm.Api.Auth;

internal static class GroupEndpoints
{
    private const int DefaultPage = 1;
    private const int DefaultTake = 20;
    private const int MaxTake = 100;
    private static readonly string[] SupportedTimeFormats = ["HH:mm", "HH:mm:ss"];
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGroupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/groups")
            .RequireAuthorization(CrmAuthorizationPolicies.ManageGroups);

        group.MapGet("/", ListGroupsAsync);
        group.MapGet("/trainers", ListTrainerOptionsAsync);
        group.MapGet("/options/trainers", ListTrainerOptionsAsync);
        group.MapGet("/{id:guid}", GetGroupAsync);
        group.MapGet("/{id:guid}/clients", GetGroupClientsAsync);
        group.MapPost("/", CreateGroupAsync);
        group.MapPut("/{id:guid}", UpdateGroupAsync);
        group.MapPut("/{id:guid}/trainers", UpdateGroupTrainersAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupListItemResponse>>, ValidationProblem>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        bool? isActive,
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = ResolvePaging(page, pageSize, skip, take);

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
        CrmDbContext dbContext,
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
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var group = await LoadGroupSnapshotAsync(id, dbContext, cancellationToken);

        return group is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapDetails(group));
    }

    private static async Task<Results<Ok<IReadOnlyList<GroupClientResponse>>, NotFound>> GetGroupClientsAsync(
        Guid id,
        CrmDbContext dbContext,
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
        CrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var trainingStartTime = ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;
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
                "TrainingGroupCreated",
                "TrainingGroup",
                group.Id.ToString(),
                $"User '{currentUser.Login}' created training group '{group.Name}'.",
                NewValueJson: SerializeAuditState(createdGroup)),
            cancellationToken);

        return TypedResults.Created($"/groups/{group.Id}", MapDetails(createdGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupAsync(
        Guid id,
        UpsertTrainingGroupRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(group);
        var trainingStartTime = ParseTrainingStartTime(normalizedRequest.TrainingStartTime)!;

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
                "TrainingGroupUpdated",
                "TrainingGroup",
                group.Id.ToString(),
                $"User '{currentUser.Login}' updated training group '{group.Name}'.",
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<Results<Ok<GroupDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupTrainersAsync(
        Guid id,
        UpdateGroupTrainersRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedTrainerIds = NormalizeTrainerIds(request.TrainerIds);
        var validationErrors = await ValidateTrainerIdsAsync(request.TrainerIds, normalizedTrainerIds, dbContext, cancellationToken);
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
                "TrainingGroupUpdated",
                "TrainingGroup",
                group.Id.ToString(),
                $"User '{currentUser.Login}' updated trainers for training group '{group.Name}'.",
                oldState,
                SerializeAuditState(updatedGroup)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedGroup));
    }

    private static async Task<TrainingGroup?> LoadGroupSnapshotAsync(
        Guid id,
        CrmDbContext dbContext,
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
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static Dictionary<string, string[]> ValidatePaging(int? page, int? pageSize, int? skip, int? take)
    {
        var errors = new Dictionary<string, string[]>();

        if (page.HasValue || pageSize.HasValue)
        {
            if (page is <= 0)
            {
                errors["page"] = ["Номер страницы должен быть больше 0."];
            }

            if (pageSize is <= 0 or > MaxTake)
            {
                errors["pageSize"] = [$"Размер страницы должен быть в диапазоне от 1 до {MaxTake}."];
            }

            return errors;
        }

        if (skip is < 0)
        {
            errors["skip"] = ["Параметр skip не может быть отрицательным."];
        }

        if (take is <= 0 or > MaxTake)
        {
            errors["take"] = [$"Параметр take должен быть в диапазоне от 1 до {MaxTake}."];
        }

        return errors;
    }

    private static Paging ResolvePaging(int? page, int? pageSize, int? skip, int? take)
    {
        if (page.HasValue || pageSize.HasValue)
        {
            var resolvedPage = page ?? DefaultPage;
            var resolvedPageSize = pageSize ?? DefaultTake;
            return new Paging((resolvedPage - 1) * resolvedPageSize, resolvedPageSize);
        }

        return new Paging(skip ?? 0, take ?? DefaultTake);
    }

    private static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedGroupRequest request,
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = ["Укажите название группы."];
        }
        else if (request.Name.Length > 128)
        {
            errors["name"] = ["Название группы не должно превышать 128 символов."];
        }

        if (string.IsNullOrWhiteSpace(request.ScheduleText))
        {
            errors["scheduleText"] = ["Укажите график тренировок."];
        }
        else if (request.ScheduleText.Length > 512)
        {
            errors["scheduleText"] = ["График тренировок не должен превышать 512 символов."];
        }

        if (ParseTrainingStartTime(request.TrainingStartTime) is null)
        {
            errors["trainingStartTime"] = ["Укажите корректное время начала тренировки в формате HH:mm."];
        }

        var trainerErrors = await ValidateTrainerIdsAsync(request.RawTrainerIds, request.TrainerIds, dbContext, cancellationToken);
        foreach (var error in trainerErrors)
        {
            errors[error.Key] = error.Value;
        }

        return errors;
    }

    private static async Task<Dictionary<string, string[]>> ValidateTrainerIdsAsync(
        IReadOnlyList<Guid>? rawTrainerIds,
        IReadOnlyList<Guid> normalizedTrainerIds,
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (rawTrainerIds?.Any(trainerId => trainerId == Guid.Empty) == true)
        {
            errors["trainerIds"] = ["Список тренеров содержит некорректный идентификатор."];
            return errors;
        }

        if (normalizedTrainerIds.Count == 0)
        {
            return errors;
        }

        var validTrainerCount = await dbContext.Users
            .AsNoTracking()
            .Where(user => normalizedTrainerIds.Contains(user.Id) && user.IsActive && user.Role == UserRole.Coach)
            .CountAsync(cancellationToken);

        if (validTrainerCount != normalizedTrainerIds.Count)
        {
            errors["trainerIds"] = ["Можно назначить только активных пользователей с ролью Coach."];
        }

        return errors;
    }

    private static NormalizedGroupRequest NormalizeRequest(UpsertTrainingGroupRequest request)
    {
        return new NormalizedGroupRequest(
            request.Name?.Trim() ?? string.Empty,
            request.TrainingStartTime?.Trim() ?? string.Empty,
            request.ScheduleText?.Trim() ?? string.Empty,
            request.IsActive,
            request.TrainerIds,
            NormalizeTrainerIds(request.TrainerIds));
    }

    private static IReadOnlyList<Guid> NormalizeTrainerIds(IReadOnlyList<Guid>? trainerIds)
    {
        return trainerIds?
            .Where(trainerId => trainerId != Guid.Empty)
            .Distinct()
            .OrderBy(trainerId => trainerId)
            .ToArray() ?? [];
    }

    private static void ApplyTrainerAssignments(
        TrainingGroup group,
        IReadOnlyList<Guid> requestedTrainerIds,
        CrmDbContext dbContext)
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

    private static async Task<ProblemHttpResult?> ValidateAntiforgeryAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(httpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return TypedResults.Problem(
                title: "InvalidCsrfToken",
                detail: "Запрос отклонен из-за некорректного CSRF-токена. Обновите страницу и повторите действие.",
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static TimeOnly? ParseTrainingStartTime(string? trainingStartTime)
    {
        return TimeOnly.TryParseExact(
            trainingStartTime?.Trim(),
            SupportedTimeFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedTime)
            ? parsedTime
            : null;
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
            ? "Клиент без имени"
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

    private sealed record Paging(int Skip, int Take);

    private sealed record UpsertTrainingGroupRequest(
        string Name,
        string TrainingStartTime,
        string ScheduleText,
        bool? IsActive,
        IReadOnlyList<Guid>? TrainerIds);

    private sealed record UpdateGroupTrainersRequest(IReadOnlyList<Guid>? TrainerIds);

    private sealed record NormalizedGroupRequest(
        string Name,
        string TrainingStartTime,
        string ScheduleText,
        bool? IsActive,
        IReadOnlyList<Guid>? RawTrainerIds,
        IReadOnlyList<Guid> TrainerIds);

    private sealed record GroupListItemResponse(
        Guid Id,
        string Name,
        string TrainingStartTime,
        string ScheduleText,
        bool IsActive,
        IReadOnlyList<TrainerSummaryResponse> Trainers,
        IReadOnlyList<Guid> TrainerIds,
        int TrainerCount,
        IReadOnlyList<string> TrainerNames,
        int ClientCount,
        DateTimeOffset UpdatedAt);

    private sealed record GroupDetailsResponse(
        Guid Id,
        string Name,
        string TrainingStartTime,
        string ScheduleText,
        bool IsActive,
        IReadOnlyList<Guid> TrainerIds,
        IReadOnlyList<TrainerSummaryResponse> Trainers,
        int ClientCount,
        DateTimeOffset UpdatedAt);

    private sealed record TrainerSummaryResponse(
        Guid Id,
        string FullName,
        string Login);

    private sealed record TrainerOptionResponse(
        Guid Id,
        string FullName,
        string Login);

    private sealed record GroupClientResponse(
        Guid Id,
        string FullName,
        string Status);

    private sealed record GroupClientProjection(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string Status);

    private sealed record TrainingGroupAuditState(
        Guid Id,
        string Name,
        string TrainingStartTime,
        string ScheduleText,
        bool IsActive,
        IReadOnlyList<Guid> TrainerIds,
        int ClientCount,
        DateTimeOffset UpdatedAt);
}
