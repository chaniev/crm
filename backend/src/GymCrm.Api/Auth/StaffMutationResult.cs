using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal sealed record StaffMutationResult(
    StaffMutationStatus Status,
    User? User = null,
    Dictionary<string, string[]>? ValidationErrors = null,
    StaffAuthorizationDenial Denial = StaffAuthorizationDenial.None)
{
    public static StaffMutationResult Created(User user) => new(StaffMutationStatus.Created, User: user);

    public static StaffMutationResult Updated(User user) => new(StaffMutationStatus.Updated, User: user);

    public static StaffMutationResult ValidationFailed(Dictionary<string, string[]> errors) =>
        new(StaffMutationStatus.ValidationFailed, ValidationErrors: errors);

    public static StaffMutationResult Forbidden(StaffAuthorizationDenial denial) =>
        new(StaffMutationStatus.Forbidden, Denial: denial);

    public static StaffMutationResult NotFound() => new(StaffMutationStatus.NotFound);
}
