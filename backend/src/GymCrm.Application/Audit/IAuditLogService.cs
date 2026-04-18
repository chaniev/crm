namespace GymCrm.Application.Audit;

public interface IAuditLogService
{
    Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default);
}
