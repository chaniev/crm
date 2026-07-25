namespace GymCrm.Application.Authorization;

public sealed record AttendanceScope(
    AttendanceScopeKind Kind,
    IReadOnlyList<Guid> GroupIds);
