namespace GymCrm.Api.Auth;

internal sealed record AttendanceMarkResponse(
    Guid ClientId,
    string State);
