namespace GymCrm.Api.Auth;

internal sealed record ClientAttentionReasonResponse(
    string Type,
    int? MissedCount = null,
    DateOnly? ExpirationDate = null,
    int? DaysUntilExpiration = null);
