using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record AuditLogUserOptionProjection(
    Guid Id,
    string FullName,
    string Login,
    UserRole Role);
