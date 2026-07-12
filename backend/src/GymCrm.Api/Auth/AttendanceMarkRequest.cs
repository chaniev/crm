namespace GymCrm.Api.Auth;

internal sealed record AttendanceMarkRequest(
    Guid ClientId,
    string? State);
