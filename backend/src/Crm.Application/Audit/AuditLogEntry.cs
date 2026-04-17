namespace Crm.Application.Audit;

public sealed record AuditLogEntry(
    Guid UserId,
    string ActionType,
    string EntityType,
    string? EntityId,
    string Description,
    string? OldValueJson = null,
    string? NewValueJson = null);
