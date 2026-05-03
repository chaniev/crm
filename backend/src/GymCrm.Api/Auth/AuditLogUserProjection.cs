using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record AuditLogUserProjection(
    Guid Id,
    string FullName,
    string Login,
    UserRole Role);
