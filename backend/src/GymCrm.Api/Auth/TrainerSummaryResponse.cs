namespace GymCrm.Api.Auth;

internal sealed record TrainerSummaryResponse(
    Guid Id,
    string FullName,
    string Login);
