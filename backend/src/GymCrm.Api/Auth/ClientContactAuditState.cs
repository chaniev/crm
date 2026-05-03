namespace GymCrm.Api.Auth;

internal sealed record ClientContactAuditState(
    string Type,
    string FullName,
    string Phone);
