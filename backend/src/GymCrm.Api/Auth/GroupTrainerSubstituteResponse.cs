namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstituteResponse(
    Guid Id,
    string FullName,
    string Login,
    bool IsActive);
