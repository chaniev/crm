namespace GymCrm.Api.Auth;

internal sealed record ExpiringClientMembershipListItemResponse(
    Guid ClientId,
    string FullName,
    string MembershipType,
    DateOnly ExpirationDate,
    int DaysUntilExpiration,
    bool IsPaid);
