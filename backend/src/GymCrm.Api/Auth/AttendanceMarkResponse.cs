namespace GymCrm.Api.Auth;

internal sealed record AttendanceMarkResponse(
    Guid ClientId,
    bool IsPresent);
