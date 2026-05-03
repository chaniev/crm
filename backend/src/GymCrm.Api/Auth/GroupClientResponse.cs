namespace GymCrm.Api.Auth;

internal sealed record GroupClientResponse(
    Guid Id,
    string FullName,
    string Status);
