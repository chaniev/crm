namespace GymCrm.Application.Authorization;

public sealed record StaffAuthorizationDecision(
    bool Allowed,
    StaffAuthorizationDenial Denial = StaffAuthorizationDenial.None)
{
    public static StaffAuthorizationDecision Allow() => new(true);

    public static StaffAuthorizationDecision Deny(StaffAuthorizationDenial denial) => new(false, denial);
}
