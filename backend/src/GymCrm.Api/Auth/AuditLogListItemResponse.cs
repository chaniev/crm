namespace GymCrm.Api.Auth;

internal sealed record AuditLogListItemResponse(
    Guid Id,
    AuditLogUserResponse User,
    string ActionType,
    string EntityType,
    string? EntityId,
    string Description,
    string Source,
    string? MessengerPlatform,
    string? OldValueJson,
    string? NewValueJson,
    DateTimeOffset CreatedAt);
