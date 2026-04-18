using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ClientEndpoints
{
    private const int DefaultPage = 1;
    private const int DefaultTake = 20;
    private const int MaxTake = 100;
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);

        group.MapGet("/", ListClientsAsync);
        group.MapGet("/{id:guid}", GetClientAsync);
        group.MapPost("/", CreateClientAsync);
        group.MapPut("/{id:guid}", UpdateClientAsync);
        group.MapPut("/{id:guid}/archive", ArchiveClientAsync);
        group.MapPut("/{id:guid}/restore", RestoreClientAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<IReadOnlyList<ClientListItemResponse>>, ValidationProblem>> ListClientsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? status,
        bool? isArchived,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidatePaging(page, pageSize, skip, take);
        foreach (var error in ValidateListFilters(status))
        {
            errors[error.Key] = error.Value;
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = ResolvePaging(page, pageSize, skip, take);
        var parsedStatus = ParseStatus(status);

        var query = dbContext.Clients.AsNoTracking();
        if (parsedStatus.HasValue)
        {
            query = query.Where(client => client.Status == parsedStatus.Value);
        }

        if (isArchived.HasValue)
        {
            var archivedStatus = isArchived.Value
                ? ClientStatus.Archived
                : ClientStatus.Active;
            query = query.Where(client => client.Status == archivedStatus);
        }

        var clients = await query
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Include(client => client.Contacts)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        IReadOnlyList<ClientListItemResponse> response = clients
            .Select(MapListItem)
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound>> GetClientAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var client = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);

        return client is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapDetails(client));
    }

    private static async Task<Results<Created<ClientDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateClientAsync(
        UpsertClientRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
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

        var now = DateTimeOffset.UtcNow;
        var client = new Client
        {
            Id = Guid.NewGuid(),
            LastName = normalizedRequest.LastName,
            FirstName = normalizedRequest.FirstName,
            MiddleName = normalizedRequest.MiddleName,
            Phone = normalizedRequest.Phone,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Clients.Add(client);
        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        await ReplaceGroupAssignmentsAsync(client.Id, normalizedRequest.GroupIds, dbContext, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        var createdClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created client '{client.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "ClientCreated",
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' created client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
                NewValueJson: SerializeAuditState(createdClient)),
            cancellationToken);

        return TypedResults.Created($"/clients/{client.Id}", MapDetails(createdClient));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientAsync(
        Guid id,
        UpsertClientRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldStateSnapshot = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        var oldState = SerializeAuditState(oldStateSnapshot ?? client);

        client.LastName = normalizedRequest.LastName;
        client.FirstName = normalizedRequest.FirstName;
        client.MiddleName = normalizedRequest.MiddleName;
        client.Phone = normalizedRequest.Phone;
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        await ReplaceGroupAssignmentsAsync(client.Id, normalizedRequest.GroupIds, dbContext, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{client.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "ClientUpdated",
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' updated client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
                oldState,
                SerializeAuditState(updatedClient)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedClient));
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ArchiveClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateClientStatusAsync(
            id,
            ClientStatus.Archived,
            "ClientArchived",
            "archived",
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> RestoreClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateClientStatusAsync(
            id,
            ClientStatus.Active,
            "ClientRestored",
            "restored",
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientStatusAsync(
        Guid id,
        ClientStatus targetStatus,
        string actionType,
        string actionVerb,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        if (client.Status == targetStatus)
        {
            return TypedResults.Ok(MapDetails(client));
        }

        var oldState = SerializeAuditState(client);
        client.Status = targetStatus;
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                actionType,
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' {actionVerb} client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
                oldState,
                SerializeAuditState(client)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(client));
    }

    private static async Task<Client?> LoadClientSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Contacts)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
            .AsSplitQuery()
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
    }

    private static async Task<Client?> LoadClientForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
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

    private static Dictionary<string, string[]> ValidateListFilters(string? status)
    {
        var errors = new Dictionary<string, string[]>();

        if (!string.IsNullOrWhiteSpace(status) && ParseStatus(status) is null)
        {
            errors["status"] = ["Укажите корректный статус клиента."];
        }

        return errors;
    }

    private static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedClientRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            errors["phone"] = ["Укажите номер телефона."];
        }
        else if (request.Phone.Length > 32)
        {
            errors["phone"] = ["Номер телефона не должен превышать 32 символа."];
        }

        ValidateNamePart(request.LastName, "lastName", "Фамилия не должна превышать 128 символов.", errors);
        ValidateNamePart(request.FirstName, "firstName", "Имя не должно превышать 128 символов.", errors);
        ValidateNamePart(request.MiddleName, "middleName", "Отчество не должно превышать 128 символов.", errors);

        if (string.IsNullOrWhiteSpace(request.LastName) &&
            string.IsNullOrWhiteSpace(request.FirstName) &&
            string.IsNullOrWhiteSpace(request.MiddleName))
        {
            errors["fullName"] = ["Укажите хотя бы одно из полей фамилии, имени или отчества."];
        }

        if (request.RawContacts?.Count > 2)
        {
            errors["contacts"] = ["У клиента может быть не более 2 контактных лиц."];
        }

        for (var index = 0; index < request.Contacts.Count; index++)
        {
            var contact = request.Contacts[index];
            if (string.IsNullOrWhiteSpace(contact.Type))
            {
                errors[$"contacts[{index}].type"] = ["Укажите тип контактного лица."];
            }
            else if (contact.Type.Length > 64)
            {
                errors[$"contacts[{index}].type"] = ["Тип контактного лица не должен превышать 64 символа."];
            }

            if (string.IsNullOrWhiteSpace(contact.FullName))
            {
                errors[$"contacts[{index}].fullName"] = ["Укажите ФИО контактного лица."];
            }
            else if (contact.FullName.Length > 256)
            {
                errors[$"contacts[{index}].fullName"] = ["ФИО контактного лица не должно превышать 256 символов."];
            }

            if (string.IsNullOrWhiteSpace(contact.Phone))
            {
                errors[$"contacts[{index}].phone"] = ["Укажите телефон контактного лица."];
            }
            else if (contact.Phone.Length > 32)
            {
                errors[$"contacts[{index}].phone"] = ["Телефон контактного лица не должен превышать 32 символа."];
            }
        }

        if (request.RawGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = ["Список групп содержит некорректный идентификатор."];
            return errors;
        }

        if (request.GroupIds.Count == 0)
        {
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = ["Можно привязать клиента только к существующим группам."];
        }

        return errors;
    }

    private static NormalizedClientRequest NormalizeRequest(UpsertClientRequest request)
    {
        return new NormalizedClientRequest(
            NormalizeOptionalText(request.LastName),
            NormalizeOptionalText(request.FirstName),
            NormalizeOptionalText(request.MiddleName),
            request.Phone?.Trim() ?? string.Empty,
            request.Contacts,
            NormalizeContacts(request.Contacts),
            request.GroupIds,
            NormalizeGroupIds(request.GroupIds));
    }

    private static IReadOnlyList<NormalizedClientContactRequest> NormalizeContacts(
        IReadOnlyList<UpsertClientContactRequest>? contacts)
    {
        if (contacts is null)
        {
            return [];
        }

        return contacts
            .Select(contact => new NormalizedClientContactRequest(
                contact.Type?.Trim() ?? string.Empty,
                contact.FullName?.Trim() ?? string.Empty,
                contact.Phone?.Trim() ?? string.Empty))
            .ToArray();
    }

    private static IReadOnlyList<Guid> NormalizeGroupIds(IReadOnlyList<Guid>? groupIds)
    {
        return groupIds?
            .Where(groupId => groupId != Guid.Empty)
            .Distinct()
            .OrderBy(groupId => groupId)
            .ToArray() ?? [];
    }

    private static async Task ReplaceContactsAsync(
        Guid clientId,
        IReadOnlyList<NormalizedClientContactRequest> requestedContacts,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var existingContacts = await dbContext.ClientContacts
            .Where(contact => contact.ClientId == clientId)
            .ToArrayAsync(cancellationToken);

        if (existingContacts.Length > 0)
        {
            dbContext.ClientContacts.RemoveRange(existingContacts);
        }

        foreach (var requestedContact in requestedContacts)
        {
            dbContext.ClientContacts.Add(new ClientContact
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                Type = requestedContact.Type,
                FullName = requestedContact.FullName,
                Phone = requestedContact.Phone
            });
        }
    }

    private static async Task ReplaceGroupAssignmentsAsync(
        Guid clientId,
        IReadOnlyList<Guid> requestedGroupIds,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requested = requestedGroupIds.ToHashSet();

        var existingGroups = await dbContext.ClientGroups
            .Where(clientGroup => clientGroup.ClientId == clientId)
            .ToArrayAsync(cancellationToken);

        var groupsToRemove = existingGroups
            .Where(clientGroup => !requested.Contains(clientGroup.GroupId))
            .ToArray();

        if (groupsToRemove.Length > 0)
        {
            dbContext.ClientGroups.RemoveRange(groupsToRemove);
        }

        var existingGroupIds = existingGroups
            .Select(clientGroup => clientGroup.GroupId)
            .ToHashSet();

        foreach (var groupId in requestedGroupIds)
        {
            if (existingGroupIds.Contains(groupId))
            {
                continue;
            }

            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientId,
                GroupId = groupId
            });
        }
    }

    private static void ValidateNamePart(
        string? value,
        string key,
        string message,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Length > 128)
        {
            errors[key] = [message];
        }
    }

    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static ClientStatus? ParseStatus(string? status)
    {
        return Enum.TryParse<ClientStatus>(status?.Trim(), ignoreCase: true, out var parsedStatus)
            ? parsedStatus
            : null;
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
                title: AuthConstants.InvalidCsrfProblemTitle,
                detail: AuthConstants.InvalidCsrfProblemDetail,
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static ClientListItemResponse MapListItem(Client client)
    {
        var groups = MapGroups(client.Groups);

        return new ClientListItemResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            client.Contacts.Count,
            client.UpdatedAt);
    }

    private static ClientDetailsResponse MapDetails(Client client)
    {
        var groups = MapGroups(client.Groups);
        var contacts = client.Contacts
            .Select(contact => new ClientContactResponse(
                contact.Type,
                contact.FullName,
                contact.Phone))
            .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
            .ToArray();

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            contacts,
            client.CreatedAt,
            client.UpdatedAt);
    }

    private static IReadOnlyList<ClientGroupSummaryResponse> MapGroups(ICollection<ClientGroup> groups)
    {
        return groups
            .Select(clientGroup => new ClientGroupSummaryResponse(
                clientGroup.GroupId,
                clientGroup.Group.Name,
                clientGroup.Group.IsActive))
            .OrderBy(group => group.Name, StringComparer.CurrentCulture)
            .ThenBy(group => group.Id)
            .ToArray();
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

    private static string SerializeAuditState(Client client)
    {
        return JsonSerializer.Serialize(
            new ClientAuditState(
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                client.Phone,
                client.Status.ToString(),
                client.Contacts
                    .Select(contact => new ClientContactAuditState(contact.Type, contact.FullName, contact.Phone))
                    .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
                    .ToArray(),
                client.Groups
                    .Select(clientGroup => clientGroup.GroupId)
                    .OrderBy(groupId => groupId)
                    .ToArray(),
                client.CreatedAt,
                client.UpdatedAt),
            AuditSerializerOptions);
    }

    private sealed record Paging(int Skip, int Take);

    private sealed record UpsertClientRequest(
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string? Phone,
        IReadOnlyList<UpsertClientContactRequest>? Contacts,
        IReadOnlyList<Guid>? GroupIds);

    private sealed record UpsertClientContactRequest(
        string? Type,
        string? FullName,
        string? Phone);

    private sealed record NormalizedClientRequest(
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string Phone,
        IReadOnlyList<UpsertClientContactRequest>? RawContacts,
        IReadOnlyList<NormalizedClientContactRequest> Contacts,
        IReadOnlyList<Guid>? RawGroupIds,
        IReadOnlyList<Guid> GroupIds);

    private sealed record NormalizedClientContactRequest(
        string Type,
        string FullName,
        string Phone);

    private sealed record ClientListItemResponse(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string FullName,
        string Phone,
        string Status,
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<ClientGroupSummaryResponse> Groups,
        int ContactCount,
        DateTimeOffset UpdatedAt);

    private sealed record ClientDetailsResponse(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string FullName,
        string Phone,
        string Status,
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<ClientGroupSummaryResponse> Groups,
        IReadOnlyList<ClientContactResponse> Contacts,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record ClientGroupSummaryResponse(
        Guid Id,
        string Name,
        bool IsActive);

    private sealed record ClientContactResponse(
        string Type,
        string FullName,
        string Phone);

    private sealed record ClientAuditState(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string Phone,
        string Status,
        IReadOnlyList<ClientContactAuditState> Contacts,
        IReadOnlyList<Guid> GroupIds,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record ClientContactAuditState(
        string Type,
        string FullName,
        string Phone);
}
