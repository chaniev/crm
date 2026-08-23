using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ClientEndpointSharedHelpers
{
    internal static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    internal static void ValidateNamePart(
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

    internal static void ValidateAdditionalFields(
        IDictionary<string, JsonElement>? additionalFields,
        Dictionary<string, string[]> errors)
    {
        if (additionalFields is null)
        {
            return;
        }

        foreach (var field in additionalFields.Keys)
        {
            errors[field] = [$"Field '{field}' is not allowed for this operation."];
        }
    }

    internal static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    internal static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
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

    internal static string SerializeAuditState(Client client)
    {
        return JsonSerializer.Serialize(
            new ClientAuditState(
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                client.Phone,
                client.BranchId,
                client.BirthDate,
                client.Notes,
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

    internal static AuditLogEntry BuildNoteAuditEntry(
        Guid actorId,
        Client client,
        string actorLogin,
        string transition)
    {
        return new AuditLogEntry(
            actorId,
            ClientAuditConstants.ClientNoteChangedAction,
            ClientAuditConstants.ClientEntityType,
            client.Id.ToString(),
            ClientAuditResources.ClientNoteChangedDescription(
                actorLogin,
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
            NewValueJson: JsonSerializer.Serialize(new { transition }, AuditSerializerOptions));
    }

    internal static async Task TryWriteClientAuditAsync(
        IAuditLogService auditLogService,
        GymCrmDbContext dbContext,
        ILoggerFactory loggerFactory,
        Guid actorId,
        Guid clientId,
        AuditLogEntry entry,
        CancellationToken cancellationToken)
    {
        try
        {
            await auditLogService.WriteAsync(entry, cancellationToken);
        }
        catch (Exception exception)
        {
            foreach (var trackedAudit in dbContext.ChangeTracker.Entries<AuditLog>()
                         .Where(tracked => tracked.State == EntityState.Added))
            {
                trackedAudit.State = EntityState.Detached;
            }

            loggerFactory.CreateLogger("ClientAudit").LogError(
                exception,
                "Client audit write failed. ActionType={ActionType} ClientId={ClientId} ActorId={ActorId}",
                entry.ActionType,
                clientId,
                actorId);
        }
    }
}
