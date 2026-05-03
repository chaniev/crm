namespace GymCrm.Api.Auth;

internal sealed record MembershipWarningResult(
    bool HasWarning,
    string? Message);
