using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientCreationWriter(GymCrmDbContext db, IAuditLogService audit, IBusinessDateProvider businessDateProvider) : IClientCreationWriter
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<Client> WriteAsync(ClientCreationData data, User actor, CancellationToken cancellationToken)
    {
        if (ClientCreationValidation.Validate(data.LastName, data.FirstName, data.MiddleName, data.Phone, data.Notes).Count > 0)
            throw new InvalidOperationException("Client creation data has not passed validation.");
        var now = DateTimeOffset.UtcNow;
        var today = businessDateProvider.Today;
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = data.BranchId,
            LastName = data.LastName,
            FirstName = data.FirstName,
            MiddleName = data.MiddleName,
            Phone = data.Phone,
            BirthDate = data.BirthDate,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        var transition = ClientNotesMetadataPolicy.Apply(client, data.Notes, actor.Id, now);
        foreach (var contact in data.Contacts)
        {
            client.Contacts.Add(new ClientContact { Id = Guid.NewGuid(), ClientId = client.Id, Type = contact.Type, FullName = contact.FullName, Phone = contact.Phone });
        }
        client.BranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = client.Id,
            BranchId = data.BranchId,
            ValidFrom = today,
            CreatedByUserId = actor.Id,
            CreatedAt = now
        });
        foreach (var group in data.GroupIds)
        {
            client.Groups.Add(new ClientGroup { ClientId = client.Id, GroupId = group, BranchId = data.BranchId });
            client.GroupAssignments.Add(new ClientGroupAssignment
            {
                Id = Guid.NewGuid(),
                ClientId = client.Id,
                GroupId = group,
                ValidFrom = today,
                CreatedByUserId = actor.Id,
                CreatedAt = now
            });
        }
        db.Clients.Add(client);
        await db.SaveChangesAsync(cancellationToken);
        var fullName = string.Join(' ', new[] { client.LastName, client.FirstName, client.MiddleName }.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));
        var state = JsonSerializer.Serialize(new
        {
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            client.Phone,
            client.BranchId,
            client.BirthDate,
            client.Notes,
            Status = client.Status.ToString(),
            Contacts = client.Contacts.Select(c => new { c.Type, c.FullName, c.Phone }).OrderBy(c => c.FullName, StringComparer.CurrentCulture).ThenBy(c => c.Type, StringComparer.CurrentCulture),
            GroupIds = data.GroupIds.Order().ToArray(),
            client.CreatedAt,
            client.UpdatedAt
        }, Json);
        await audit.WriteAsync(new(actor.Id, "ClientCreated", "Client", client.Id.ToString(),
            string.Format(CultureInfo.CurrentCulture, ClientImportText.CreatedDescription, actor.Login, fullName), NewValueJson: state), cancellationToken);
        if (transition is not null)
        {
            await audit.WriteAsync(new(actor.Id, "ClientNoteChanged", "Client", client.Id.ToString(),
                string.Format(CultureInfo.CurrentCulture, ClientImportText.NoteDescription, actor.Login, fullName),
                NewValueJson: JsonSerializer.Serialize(new { transition }, Json)), cancellationToken);
        }
        return client;
    }
}
