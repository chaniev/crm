using GymCrm.Application.Audit;
using GymCrm.Domain.Audit;
using GymCrm.Infrastructure.Persistence;

namespace GymCrm.Infrastructure.Audit;

internal sealed class AuditLogService(GymCrmDbContext dbContext) : IAuditLogService
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
