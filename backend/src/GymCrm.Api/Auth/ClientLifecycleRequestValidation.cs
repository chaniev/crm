using System.Text.Json;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;


namespace GymCrm.Api.Auth;

internal static class ClientLifecycleRequestValidation
{
    internal static async Task<Client?> LoadClientForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
    }

    internal static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedClientRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken,
        Guid? currentBranchId = null)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            errors["phone"] = [ClientResources.PhoneRequired];
        }
        else if (request.Phone.Length > 32)
        {
            errors["phone"] = [ClientResources.PhoneTooLong];
        }

        if (request.Notes is not null && request.Notes.Length > ClientApiConstants.NotesMaxLength)
        {
            errors["notes"] = [ClientResources.NotesTooLong];
        }

        ValidateNamePart(request.LastName, "lastName", ClientResources.LastNameTooLong, errors);
        ValidateNamePart(request.FirstName, "firstName", ClientResources.FirstNameTooLong, errors);
        ValidateNamePart(request.MiddleName, "middleName", ClientResources.MiddleNameTooLong, errors);

        if (string.IsNullOrWhiteSpace(request.LastName) &&
            string.IsNullOrWhiteSpace(request.FirstName) &&
            string.IsNullOrWhiteSpace(request.MiddleName))
        {
            errors["fullName"] = [ClientResources.FullNameRequired];
        }

        await ValidateClientBranchAsync(request.BranchId, currentBranchId, errors, dbContext, cancellationToken);

        if (request.RawContacts?.Count > 2)
        {
            errors["contacts"] = [ClientResources.ContactsLimitExceeded];
        }

        for (var index = 0; index < request.Contacts.Count; index++)
        {
            var contact = request.Contacts[index];
            if (string.IsNullOrWhiteSpace(contact.Type))
            {
                errors[$"contacts[{index}].type"] = [ClientResources.ContactTypeRequired];
            }
            else if (contact.Type.Length > 64)
            {
                errors[$"contacts[{index}].type"] = [ClientResources.ContactTypeTooLong];
            }

            if (string.IsNullOrWhiteSpace(contact.FullName))
            {
                errors[$"contacts[{index}].fullName"] = [ClientResources.ContactFullNameRequired];
            }
            else if (contact.FullName.Length > 256)
            {
                errors[$"contacts[{index}].fullName"] = [ClientResources.ContactFullNameTooLong];
            }

            if (string.IsNullOrWhiteSpace(contact.Phone))
            {
                errors[$"contacts[{index}].phone"] = [ClientResources.ContactPhoneRequired];
            }
            else if (contact.Phone.Length > 32)
            {
                errors[$"contacts[{index}].phone"] = [ClientResources.ContactPhoneTooLong];
            }
        }

        if (request.RawGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = [ClientResources.InvalidGroupId];
            return errors;
        }

        if (request.GroupIds.Count == 0)
        {
            errors["groupIds"] = [ClientResources.ClientGroupsRequired];
        }

        if (request.GroupIds.Count == 0 || errors.ContainsKey("branchId"))
        {
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustExist];
            return errors;
        }

        var sameBranchGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id) && group.BranchId == request.BranchId!.Value)
            .CountAsync(cancellationToken);

        if (sameBranchGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustBelongToClientBranch];
        }

        return errors;
    }

    private static async Task ValidateClientBranchAsync(
        Guid? requestedBranchId,
        Guid? currentBranchId,
        Dictionary<string, string[]> errors,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!requestedBranchId.HasValue)
        {
            errors["branchId"] = [ClientResources.BranchRequired];
            return;
        }

        if (requestedBranchId.Value == Guid.Empty)
        {
            errors["branchId"] = [ClientResources.InvalidBranchId];
            return;
        }

        if (currentBranchId.HasValue && requestedBranchId.Value != currentBranchId.Value)
        {
            errors["branchId"] = [ClientResources.BranchTransferRequired];
            return;
        }

        var branch = await dbContext.Branches
            .AsNoTracking()
            .Where(candidate => candidate.Id == requestedBranchId.Value)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IsArchived
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (branch is null)
        {
            errors["branchId"] = [ClientResources.BranchMustExist];
        }
        else if (branch.IsArchived)
        {
            errors["branchId"] = [ClientResources.BranchMustBeActive];
        }
    }

    internal static async Task<Dictionary<string, string[]>> ValidateTransferRequestAsync(
        TransferClientBranchRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        var groupIds = NormalizeTransferGroupIds(request);

        var targetBranchId = request.TargetBranchId ?? request.BranchId;
        await ValidateClientBranchAsync(targetBranchId, currentBranchId: null, errors, dbContext, cancellationToken);
        if (request.GroupId == Guid.Empty || request.GroupIds?.Any(groupId => groupId == Guid.Empty) == true ||
            request.TargetGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = [ClientResources.InvalidGroupId];
        }

        if (groupIds.Count == 0)
        {
            errors["groupIds"] = [ClientResources.ClientGroupsRequired];
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => groupIds.Contains(candidate.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != groupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustExist];
            return errors;
        }

        var sameBranchGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => groupIds.Contains(candidate.Id) && candidate.BranchId == targetBranchId!.Value)
            .CountAsync(cancellationToken);

        if (sameBranchGroupCount != groupIds.Count)
        {
            errors["groupIds"] = [ClientResources.TransferGroupMustBelongToTargetBranch];
        }

        return errors;
    }

    internal static async Task<(UpsertClientRequest? Request, ProblemHttpResult? Problem)> ReadUpsertClientRequestAsync(
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        try
        {
            var request = await httpRequest.ReadFromJsonAsync<UpsertClientRequest>(
                cancellationToken);

            return request is null
                ? (null, CreateInvalidUpsertJsonProblem())
                : (request, null);
        }
        catch (JsonException)
        {
            return (null, CreateInvalidUpsertJsonProblem());
        }
    }

    private static ProblemHttpResult CreateInvalidUpsertJsonProblem() =>
        TypedResults.Problem(
            title: "Bad Request",
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            statusCode: StatusCodes.Status400BadRequest);

    internal static NormalizedClientRequest NormalizeRequest(UpsertClientRequest request)
    {
        return new NormalizedClientRequest(
            NormalizeOptionalText(request.LastName),
            NormalizeOptionalText(request.FirstName),
            NormalizeOptionalText(request.MiddleName),
            request.Phone?.Trim() ?? string.Empty,
            request.BranchId,
            request.BirthDate,
            NormalizeOptionalText(request.Notes),
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

    internal static IReadOnlyList<Guid> NormalizeTransferGroupIds(TransferClientBranchRequest request)
    {
        var groupIds = request.TargetGroupIds is { Count: > 0 }
            ? request.TargetGroupIds
            : request.GroupIds is { Count: > 0 }
                ? request.GroupIds
            : request.GroupId.HasValue
                ? [request.GroupId.Value]
                : [];

        return groupIds
            .Where(groupId => groupId != Guid.Empty)
            .Distinct()
            .OrderBy(groupId => groupId)
            .ToArray();
    }

    internal static async Task ReplaceContactsAsync(
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

    internal static async Task ReplaceGroupAssignmentsAsync(
        Guid clientId,
        Guid branchId,
        IReadOnlyList<Guid> requestedGroupIds,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requested = requestedGroupIds.ToHashSet();
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);

        var existingGroups = await dbContext.ClientGroups
            .Where(clientGroup => clientGroup.ClientId == clientId)
            .ToArrayAsync(cancellationToken);
        var activeAssignments = await dbContext.ClientGroupAssignments
            .Where(assignment => assignment.ClientId == clientId && assignment.ValidTo == null)
            .ToArrayAsync(cancellationToken);

        var groupsToRemove = existingGroups
            .Where(clientGroup => !requested.Contains(clientGroup.GroupId))
            .ToArray();

        if (groupsToRemove.Length > 0)
        {
            dbContext.ClientGroups.RemoveRange(groupsToRemove);
        }

        foreach (var assignment in activeAssignments.Where(assignment => !requested.Contains(assignment.GroupId)))
        {
            CloseOrRemovePeriod(assignment, today, dbContext.ClientGroupAssignments);
        }

        var existingGroupIds = existingGroups
            .Select(clientGroup => clientGroup.GroupId)
            .ToHashSet();
        var activeAssignmentGroupIds = activeAssignments
            .Where(assignment => requested.Contains(assignment.GroupId))
            .Select(assignment => assignment.GroupId)
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
                GroupId = groupId,
                BranchId = branchId
            });
        }

        foreach (var groupId in requestedGroupIds.Where(groupId => !activeAssignmentGroupIds.Contains(groupId)))
        {
            dbContext.ClientGroupAssignments.Add(new ClientGroupAssignment
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                GroupId = groupId,
                ValidFrom = today,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            });
        }
    }

    internal static void OpenBranchAssignment(
        Guid clientId,
        Guid branchId,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        dbContext.ClientBranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BranchId = branchId,
            ValidFrom = DateOnly.FromDateTime(now.UtcDateTime.Date),
            CreatedByUserId = changedByUserId,
            CreatedAt = now
        });
    }

    internal static async Task CloseActiveBranchAssignmentsAsync(
        Guid clientId,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);
        var activeAssignments = await dbContext.ClientBranchAssignments
            .Where(assignment => assignment.ClientId == clientId && assignment.ValidTo == null)
            .ToArrayAsync(cancellationToken);

        foreach (var assignment in activeAssignments)
        {
            CloseOrRemovePeriod(assignment, today, dbContext.ClientBranchAssignments);
        }
    }

    private static void CloseOrRemovePeriod(ClientBranchAssignment assignment, DateOnly validTo, DbSet<ClientBranchAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }

    private static void CloseOrRemovePeriod(ClientGroupAssignment assignment, DateOnly validTo, DbSet<ClientGroupAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }
}
