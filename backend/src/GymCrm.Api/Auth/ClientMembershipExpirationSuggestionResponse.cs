namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipExpirationSuggestionResponse(
    string BehaviorKind,
    DateOnly StartDate,
    DateOnly? ExpirationDate);
