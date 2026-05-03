namespace GymCrm.Api.Auth;

internal sealed record AttendanceMarkRequest(
    Guid ClientId,
    bool IsPresent);
