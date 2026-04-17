using Crm.Application.Audit;
using Crm.Domain.Audit;
using Crm.Infrastructure.Persistence;

namespace Crm.Infrastructure.Audit;

internal sealed class AuditLogService(CrmDbContext dbContext) : IAuditLogService
{
    public async Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = entry.UserId,
            ActionType = entry.ActionType,
            EntityType = entry.EntityType,
            EntityId = entry.EntityId,
            Description = entry.Description,
            OldValueJson = entry.OldValueJson,
            NewValueJson = entry.NewValueJson,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
