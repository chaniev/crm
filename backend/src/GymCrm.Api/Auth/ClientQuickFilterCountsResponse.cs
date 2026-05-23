namespace GymCrm.Api.Auth;

internal sealed record ClientQuickFilterCountsResponse(
    int WithoutMembership,
    int ExpiringSoon,
    int WithoutGroup,
    int Trial);
