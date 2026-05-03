namespace GymCrm.Api.Auth;

internal sealed record AuditLogFilterOptionsResponse(
    IReadOnlyList<AuditLogUserResponse> Users,
    IReadOnlyList<string> ActionTypes,
    IReadOnlyList<string> EntityTypes,
    IReadOnlyList<string> Sources,
    IReadOnlyList<string> MessengerPlatforms);
