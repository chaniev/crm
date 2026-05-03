namespace GymCrm.Api.Auth;

internal sealed record ClientContactResponse(
    string Type,
    string FullName,
    string Phone);
