namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstitutionResponse(
    Guid Id,
    Guid GroupId,
    GroupTrainerSubstituteResponse SubstituteTrainer,
    DateOnly StartsOn,
    DateOnly EndsOn,
    string Status,
    DateTimeOffset? CancelledAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    GroupTrainerSubstitutionAllowedActionsResponse AllowedActions);
