namespace GymCrm.Api.Auth;

internal sealed record GroupTrainerSubstitutionAuditState(
    Guid Id,
    Guid GroupId,
    Guid SubstituteTrainerId,
    DateOnly StartsOn,
    DateOnly EndsOn,
    DateTimeOffset? CancelledAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
