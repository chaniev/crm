namespace GymCrm.Api.Auth;

internal sealed record AuditLogListItemProjection(
    Guid Id,
    AuditLogUserProjection User,
    string ActionType,
    string EntityType,
    string? EntityId,
    string Description,
    string Source,
    string? MessengerPlatform,
    string? OldValueJson,
    string? NewValueJson,
    DateTimeOffset CreatedAt);
