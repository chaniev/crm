namespace GymCrm.Api.Auth;

internal enum ClientMembershipState
{
    None,
    Active,
    Future,
    Expired,
    UsedSingleVisit,
    LegacyTargetMissing
}
