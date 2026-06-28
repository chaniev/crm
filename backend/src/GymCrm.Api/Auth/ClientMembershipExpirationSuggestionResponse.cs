namespace GymCrm.Api.Auth;

internal sealed record ClientMembershipExpirationSuggestionResponse(
    string MembershipType,
    DateOnly StartDate,
    DateOnly? ExpirationDate);
