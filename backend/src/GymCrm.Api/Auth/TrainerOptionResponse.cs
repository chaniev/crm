namespace GymCrm.Api.Auth;

internal sealed record TrainerOptionResponse(
    Guid Id,
    string FullName,
    string Login);
