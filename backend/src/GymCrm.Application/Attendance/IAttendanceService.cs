using GymCrm.Application.Clients;

namespace GymCrm.Application.Attendance;

public interface IAttendanceService
{
    Task<AttendanceBatchMutationResult> SaveAsync(
        SaveAttendanceCommand command,
        CancellationToken cancellationToken);
}

public sealed record SaveAttendanceCommand(
    Guid GroupId,
    DateOnly TrainingDate,
    Guid MarkedByUserId,
    IReadOnlyList<AttendanceMarkCommand> Marks);

public sealed record AttendanceMarkCommand(
    Guid ClientId,
    bool IsPresent);

public enum AttendanceBatchMutationError
{
    None = 0,
    GroupMissing = 1,
    InvalidRequest = 2,
    ClientOutsideGroup = 3
}

public sealed record AttendanceEntryChangeResult(
    Guid AttendanceId,
    Guid ClientId,
    bool? PreviousIsPresent,
    bool CurrentIsPresent,
    bool WasCreated);

public sealed record AttendanceSingleVisitWriteOffResult(
    Guid ClientId,
    ClientMembershipSnapshotResult PreviousMembership,
    ClientMembershipSnapshotResult CurrentMembership);

public sealed record AttendanceBatchSaveResult(
    Guid GroupId,
    DateOnly TrainingDate,
    IReadOnlyList<AttendanceEntryChangeResult> Changes,
    IReadOnlyList<AttendanceSingleVisitWriteOffResult> SingleVisitWriteOffs,
    IReadOnlyList<Guid> InvalidClientIds);

public readonly record struct AttendanceBatchMutationResult(
    AttendanceBatchMutationError Error,
    AttendanceBatchSaveResult? Details)
{
    public bool Succeeded => Error == AttendanceBatchMutationError.None;

    public static AttendanceBatchMutationResult Success(AttendanceBatchSaveResult details) =>
        new(AttendanceBatchMutationError.None, details);

    public static AttendanceBatchMutationResult Failure(
        AttendanceBatchMutationError error,
        AttendanceBatchSaveResult? details = null) =>
        new(error, details);
}
