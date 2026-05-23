namespace GymCrm.Api.Auth;

internal sealed record ClientActionHintResponse(
    string Title,
    string Description,
    string Tone,
    string IconKey,
    int? DaysUntilExpiration);
