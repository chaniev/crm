namespace GymCrm.Api.Auth;

internal sealed record AuditLogUserResponse(
    Guid Id,
    string FullName,
    string Login,
    string Role);
