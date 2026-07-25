namespace GymCrm.Api.Auth;

internal sealed record UpsertGroupTrainerSubstitutionRequest(
    Guid? SubstituteTrainerId,
    string? StartsOn,
    string? EndsOn);
