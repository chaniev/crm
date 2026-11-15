using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientImportService(GymCrmDbContext db, IClientXlsxReader reader, IClientCreationWriter writer, IAuditLogService audit) : IClientImportService
{
    public async Task<ClientImportResult> ImportAsync(Guid actorId, Guid branchId, string groupName, Guid operationId, Stream file, CancellationToken cancellationToken)
    {
        ClientImportResult Failure(string code, string? field, string message) => new(operationId, 0, code, [new(null, field, code, message)]);
        var actor = await ClientAccessTransaction.LoadActorAsync(db, actorId, cancellationToken);
        if (actor is null || !ClientImportScope.Allows(actor, branchId) || actor.MustChangePassword)
            return Failure("import_forbidden", null, ClientImportText.Forbidden);
        if (!await db.Branches.AnyAsync(b => b.Id == branchId && !b.IsArchived, cancellationToken))
            return Failure("branch_invalid", "branchId", ClientImportText.BranchInvalid);
        groupName = groupName.Trim();
        var groups = await db.TrainingGroups.AsNoTracking().Where(g => g.BranchId == branchId && g.Name == groupName).Select(g => g.Id).ToArrayAsync(cancellationToken);
        if (groups.Length != 1) return Failure("group_invalid", "groupName", ClientImportText.GroupMissing);
        var groupId = groups[0];
        var read = await reader.ReadAsync(file, cancellationToken);
        var mapped = ClientImportMapping.Map(read.Rows);
        var issues = read.Issues.Concat(mapped.Issues).ToArray();
        if (issues.Length > 0) return new(operationId, 0, read.LimitExceeded ? "import_limit" : "file_invalid", issues);
        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(db, actorId, null, [groupId], [branchId], cancellationToken);
        actor = await ClientAccessTransaction.LoadActorAsync(db, actorId, cancellationToken);
        if (actor is null || !ClientImportScope.Allows(actor, branchId) || actor.MustChangePassword)
            return Failure("import_forbidden", null, ClientImportText.Forbidden);
        if (!await db.Branches.AnyAsync(b => b.Id == branchId && !b.IsArchived, cancellationToken))
            return Failure("branch_invalid", "branchId", ClientImportText.BranchInvalid);
        var current = await db.TrainingGroups.AsNoTracking().Where(g => g.BranchId == branchId && g.Name == groupName).Select(g => g.Id).ToArrayAsync(cancellationToken);
        if (current.Length != 1 || current[0] != groupId) return Failure("group_changed", "groupName", ClientImportText.GroupChanged);
        var clients = new List<Guid>();
        foreach (var row in mapped.Rows)
        {
            var client = await writer.WriteAsync(new(row.LastName, row.FirstName, row.MiddleName, row.Phone, branchId, row.BirthDate, row.Notes, [groupId], []), actor, cancellationToken);
            clients.Add(client.Id);
        }
        await audit.WriteAsync(new(actorId, "ClientImportCompleted", "ClientImport", operationId.ToString(), ClientImportText.CompletedDescription,
            NewValueJson: JsonSerializer.Serialize(new { operationId, createdCount = clients.Count, clientIds = clients })), cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return new(operationId, clients.Count);
    }
}
