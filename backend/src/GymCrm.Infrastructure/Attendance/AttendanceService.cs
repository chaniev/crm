using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Infrastructure.AttendanceFeatures;

internal sealed class AttendanceService(
    GymCrmDbContext dbContext,
    IClientMembershipService clientMembershipService) : IAttendanceService
{
    public async Task<AttendanceBatchMutationResult> SaveAsync(
        SaveAttendanceCommand command,
        CancellationToken cancellationToken)
    {
        if (command.GroupId == Guid.Empty ||
            command.MarkedByUserId == Guid.Empty ||
            command.TrainingDate == default ||
            command.Marks.Any(mark => mark.ClientId == Guid.Empty) ||
            command.Marks.Select(mark => mark.ClientId).Distinct().Count() != command.Marks.Count)
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.InvalidRequest);
        }

        var groupExists = await dbContext.TrainingGroups
            .AsNoTracking()
            .AnyAsync(group => group.Id == command.GroupId, cancellationToken);

        if (!groupExists)
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.GroupMissing);
        }

        var requestedClientIds = command.Marks
            .Select(mark => mark.ClientId)
            .OrderBy(clientId => clientId)
            .ToArray();

        if (requestedClientIds.Length > 0)
        {
            var allowedClientIds = await dbContext.ClientGroups
                .AsNoTracking()
                .Where(clientGroup =>
                    clientGroup.GroupId == command.GroupId &&
                    requestedClientIds.Contains(clientGroup.ClientId) &&
                    clientGroup.Client.Status == ClientStatus.Active)
                .Select(clientGroup => clientGroup.ClientId)
                .Distinct()
                .ToArrayAsync(cancellationToken);

            var invalidClientIds = requestedClientIds
                .Except(allowedClientIds)
                .OrderBy(clientId => clientId)
                .ToArray();

            if (invalidClientIds.Length > 0)
            {
                return AttendanceBatchMutationResult.Failure(
                    AttendanceBatchMutationError.ClientOutsideGroup,
                    new AttendanceBatchSaveResult(
                        command.GroupId,
                        command.TrainingDate,
                        [],
                        [],
                        invalidClientIds));
            }
        }

        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var useTransaction = !providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var existingEntries = requestedClientIds.Length == 0
            ? new Dictionary<Guid, AttendanceEntry>()
            : await dbContext.Attendance
                .Where(attendance =>
                    attendance.GroupId == command.GroupId &&
                    attendance.TrainingDate == command.TrainingDate &&
                    requestedClientIds.Contains(attendance.ClientId))
                .ToDictionaryAsync(attendance => attendance.ClientId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var changes = new List<AttendanceEntryChangeResult>(command.Marks.Count);

        foreach (var mark in command.Marks.OrderBy(mark => mark.ClientId))
        {
            if (existingEntries.TryGetValue(mark.ClientId, out var existingEntry))
            {
                if (existingEntry.IsPresent == mark.IsPresent)
                {
                    continue;
                }

                var previousIsPresent = existingEntry.IsPresent;
                existingEntry.IsPresent = mark.IsPresent;
                existingEntry.MarkedByUserId = command.MarkedByUserId;
                existingEntry.MarkedAt = now;
                existingEntry.UpdatedAt = now;

                changes.Add(new AttendanceEntryChangeResult(
                    existingEntry.Id,
                    existingEntry.ClientId,
                    previousIsPresent,
                    existingEntry.IsPresent,
                    false));

                continue;
            }

            var attendanceEntry = new AttendanceEntry
            {
                Id = Guid.NewGuid(),
                ClientId = mark.ClientId,
                GroupId = command.GroupId,
                TrainingDate = command.TrainingDate,
                IsPresent = mark.IsPresent,
                MarkedByUserId = command.MarkedByUserId,
                MarkedAt = now,
                UpdatedAt = now
            };

            dbContext.Attendance.Add(attendanceEntry);
            existingEntries[mark.ClientId] = attendanceEntry;

            changes.Add(new AttendanceEntryChangeResult(
                attendanceEntry.Id,
                attendanceEntry.ClientId,
                null,
                attendanceEntry.IsPresent,
                true));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var singleVisitWriteOffs = new List<AttendanceSingleVisitWriteOffResult>();
        foreach (var clientId in changes
                     .Where(change => change.CurrentIsPresent)
                     .Select(change => change.ClientId)
                     .Distinct()
                     .OrderBy(clientId => clientId))
        {
            var writeOffResult = await clientMembershipService.WriteOffSingleVisitAsync(
                clientId,
                new WriteOffSingleVisitCommand(command.MarkedByUserId, command.TrainingDate),
                cancellationToken);

            if (!writeOffResult.Applied ||
                writeOffResult.PreviousMembership is null ||
                writeOffResult.CurrentMembership is null)
            {
                continue;
            }

            singleVisitWriteOffs.Add(new AttendanceSingleVisitWriteOffResult(
                clientId,
                writeOffResult.PreviousMembership,
                writeOffResult.CurrentMembership));
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return AttendanceBatchMutationResult.Success(
            new AttendanceBatchSaveResult(
                command.GroupId,
                command.TrainingDate,
                changes,
                singleVisitWriteOffs,
                []));
    }
}
