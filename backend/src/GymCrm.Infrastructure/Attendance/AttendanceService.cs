using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Infrastructure.AttendanceFeatures;

internal sealed class AttendanceService(
    GymCrmDbContext dbContext,
    IClientMembershipService clientMembershipService,
    IAuditLogService auditLogService,
    IBusinessDateProvider businessDateProvider,
    TimeProvider timeProvider) : IAttendanceService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<AttendanceBatchMutationResult> SaveAsync(
        SaveAttendanceCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValid(command))
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.InvalidRequest);
        }

        if (command.TrainingDate > businessDateProvider.Today)
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.TrainingDateInFuture);
        }

        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => candidate.Id == command.GroupId)
            .Select(candidate => new { candidate.Id, candidate.Name })
            .SingleOrDefaultAsync(cancellationToken);
        if (group is null)
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.GroupMissing);
        }

        var requestedClientIds = command.Marks.Select(mark => mark.ClientId).Order().ToArray();
        var clientNames = requestedClientIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.ClientGroups
                .AsNoTracking()
                .Where(clientGroup =>
                    clientGroup.GroupId == command.GroupId &&
                    requestedClientIds.Contains(clientGroup.ClientId) &&
                    clientGroup.Client.Status == ClientStatus.Active)
                .Select(clientGroup => new
                {
                    clientGroup.ClientId,
                    clientGroup.Client.LastName,
                    clientGroup.Client.FirstName,
                    clientGroup.Client.MiddleName
                })
                .Distinct()
                .ToDictionaryAsync(
                    client => client.ClientId,
                    client => BuildClientName(client.LastName, client.FirstName, client.MiddleName),
                    cancellationToken);

        var invalidClientIds = requestedClientIds.Except(clientNames.Keys).Order().ToArray();
        if (invalidClientIds.Length > 0)
        {
            return AttendanceBatchMutationResult.Failure(
                AttendanceBatchMutationError.ClientOutsideGroup,
                new AttendanceBatchSaveResult(command.GroupId, command.TrainingDate, [], [], [], invalidClientIds));
        }

        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var supportsTransactions = !providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase);
        if (supportsTransactions && dbContext.Database.CurrentTransaction is not null)
        {
            throw new InvalidOperationException("AttendanceService owns its transaction and cannot run inside an ambient database transaction.");
        }

        await using var ownedTransaction = supportsTransactions
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            var existingEntries = requestedClientIds.Length == 0
            ? new Dictionary<Guid, AttendanceEntry>()
            : await dbContext.Attendance
                .Where(attendance =>
                    attendance.GroupId == command.GroupId &&
                    attendance.TrainingDate == command.TrainingDate &&
                    requestedClientIds.Contains(attendance.ClientId))
                .ToDictionaryAsync(attendance => attendance.ClientId, cancellationToken);

            var now = timeProvider.GetUtcNow();
            var changes = new List<AttendanceEntryChangeResult>();
            var writeOffs = new List<AttendanceSingleVisitWriteOffResult>();
            var restores = new List<AttendanceSingleVisitRestoreResult>();

            foreach (var mark in command.Marks.OrderBy(mark => mark.ClientId))
            {
                existingEntries.TryGetValue(mark.ClientId, out var entry);
                var previousState = MapState(entry);
                if (previousState == mark.State)
                {
                    continue;
                }

                if (previousState == AttendanceState.Present &&
                    mark.State != AttendanceState.Present &&
                    entry!.SingleVisitMembershipSaleId.HasValue &&
                    entry.SingleVisitWriteOffMembershipId.HasValue)
                {
                    var restore = await clientMembershipService.RestoreSingleVisitAsync(
                        mark.ClientId,
                        new RestoreSingleVisitCommand(
                            command.MarkedByUserId,
                            entry.SingleVisitMembershipSaleId.Value,
                            entry.SingleVisitWriteOffMembershipId.Value),
                        cancellationToken);
                    if (!restore.Applied || restore.PreviousMembership is null || restore.CurrentMembership is null)
                    {
                        if (ownedTransaction is not null)
                        {
                            await ownedTransaction.RollbackAsync(cancellationToken);
                        }

                        return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.SingleVisitRestoreConflict);
                    }

                    restores.Add(new AttendanceSingleVisitRestoreResult(
                        mark.ClientId,
                        restore.PreviousMembership,
                        restore.CurrentMembership));
                    entry.SingleVisitMembershipSaleId = null;
                    entry.SingleVisitWriteOffMembershipId = null;
                }

                var wasCreated = entry is null;
                if (mark.State == AttendanceState.Unmarked)
                {
                    dbContext.Attendance.Remove(entry!);
                }
                else if (entry is null)
                {
                    entry = new AttendanceEntry
                    {
                        Id = Guid.NewGuid(),
                        ClientId = mark.ClientId,
                        GroupId = command.GroupId,
                        TrainingDate = command.TrainingDate,
                        IsPresent = mark.State == AttendanceState.Present,
                        MarkedByUserId = command.MarkedByUserId,
                        MarkedAt = now,
                        UpdatedAt = now
                    };
                    dbContext.Attendance.Add(entry);
                    existingEntries[mark.ClientId] = entry;
                }
                else
                {
                    entry.IsPresent = mark.State == AttendanceState.Present;
                    entry.MarkedByUserId = command.MarkedByUserId;
                    entry.MarkedAt = now;
                    entry.UpdatedAt = now;
                }

                if (mark.State == AttendanceState.Present)
                {
                    var writeOff = await clientMembershipService.WriteOffSingleVisitAsync(
                        mark.ClientId,
                        new WriteOffSingleVisitCommand(command.MarkedByUserId, command.TrainingDate),
                        cancellationToken);
                    if (writeOff.Applied && writeOff.PreviousMembership is not null && writeOff.CurrentMembership is not null)
                    {
                        entry!.SingleVisitMembershipSaleId = writeOff.CurrentMembership.SaleId;
                        entry.SingleVisitWriteOffMembershipId = writeOff.CurrentMembership.Id;
                        writeOffs.Add(new AttendanceSingleVisitWriteOffResult(
                            mark.ClientId,
                            writeOff.PreviousMembership,
                            writeOff.CurrentMembership));
                    }
                }

                changes.Add(new AttendanceEntryChangeResult(
                    entry!.Id,
                    mark.ClientId,
                    previousState,
                    mark.State,
                    wasCreated));
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await WriteDomainAuditsAsync(command, group.Name, clientNames, changes, writeOffs, restores, cancellationToken);

            if (ownedTransaction is not null)
            {
                await ownedTransaction.CommitAsync(cancellationToken);
            }
            return AttendanceBatchMutationResult.Success(new AttendanceBatchSaveResult(
                command.GroupId,
                command.TrainingDate,
                changes,
                writeOffs,
                restores,
                []));
        }
        catch
        {
            if (ownedTransaction is not null)
            {
                await ownedTransaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
    }

    private async Task WriteDomainAuditsAsync(
        SaveAttendanceCommand command,
        string groupName,
        IReadOnlyDictionary<Guid, string> clientNames,
        IReadOnlyList<AttendanceEntryChangeResult> changes,
        IReadOnlyList<AttendanceSingleVisitWriteOffResult> writeOffs,
        IReadOnlyList<AttendanceSingleVisitRestoreResult> restores,
        CancellationToken cancellationToken)
    {
        foreach (var change in changes)
        {
            var clientName = clientNames.GetValueOrDefault(change.ClientId, change.ClientId.ToString());
            await auditLogService.WriteAsync(new AuditLogEntry(
                command.MarkedByUserId,
                change.WasCreated ? AttendanceAuditContract.AttendanceMarkedAction : AttendanceAuditContract.AttendanceUpdatedAction,
                AttendanceAuditContract.AttendanceEntityType,
                change.AttendanceId.ToString(),
                AttendanceAuditContract.AttendanceChangedDescription(command.ActorLogin, clientName, groupName, command.TrainingDate),
                SerializeAttendanceState(change.ClientId, command, change.PreviousState),
                SerializeAttendanceState(change.ClientId, command, change.CurrentState),
                command.AuditContext.Source,
                command.AuditContext.MessengerPlatform,
                command.AuditContext.MessengerPlatformUserIdHash), cancellationToken);
        }

        foreach (var writeOff in writeOffs)
        {
            await WriteMembershipAuditAsync(
                command,
                writeOff.ClientId,
                AttendanceAuditContract.SingleVisitWrittenOffAction,
                AttendanceAuditContract.SingleVisitWrittenOffDescription(command.ActorLogin, clientNames.GetValueOrDefault(writeOff.ClientId, writeOff.ClientId.ToString())),
                writeOff.PreviousMembership,
                writeOff.CurrentMembership,
                cancellationToken);
        }

        foreach (var restore in restores)
        {
            await WriteMembershipAuditAsync(
                command,
                restore.ClientId,
                AttendanceAuditContract.SingleVisitRestoredAction,
                AttendanceAuditContract.SingleVisitRestoredDescription(command.ActorLogin, clientNames.GetValueOrDefault(restore.ClientId, restore.ClientId.ToString())),
                restore.PreviousMembership,
                restore.CurrentMembership,
                cancellationToken);
        }
    }

    private async Task WriteMembershipAuditAsync(
        SaveAttendanceCommand command,
        Guid clientId,
        string action,
        string description,
        ClientMembershipSnapshotResult previous,
        ClientMembershipSnapshotResult current,
        CancellationToken cancellationToken)
    {
        await auditLogService.WriteAsync(new AuditLogEntry(
            command.MarkedByUserId,
            action,
            AttendanceAuditContract.MembershipEntityType,
            current.Id.ToString(),
            description,
            SerializeMembershipState(clientId, previous),
            SerializeMembershipState(clientId, current),
            command.AuditContext.Source,
            command.AuditContext.MessengerPlatform,
            command.AuditContext.MessengerPlatformUserIdHash), cancellationToken);
    }

    private static AttendanceState MapState(AttendanceEntry? entry) => entry switch
    {
        null => AttendanceState.Unmarked,
        { IsPresent: true } => AttendanceState.Present,
        _ => AttendanceState.Absent
    };

    private static bool IsValid(SaveAttendanceCommand command) =>
        command.GroupId != Guid.Empty &&
        command.MarkedByUserId != Guid.Empty &&
        command.TrainingDate != default &&
        !string.IsNullOrWhiteSpace(command.ActorLogin) &&
        command.Marks.All(mark => mark.ClientId != Guid.Empty && Enum.IsDefined(mark.State)) &&
        command.Marks.Select(mark => mark.ClientId).Distinct().Count() == command.Marks.Count;

    private static string BuildClientName(string? lastName, string? firstName, string? middleName)
    {
        var result = string.Join(' ', new[] { lastName, firstName, middleName }.Where(value => !string.IsNullOrWhiteSpace(value)));
        return string.IsNullOrWhiteSpace(result) ? "Клиент без имени" : result;
    }

    private static string SerializeAttendanceState(Guid clientId, SaveAttendanceCommand command, AttendanceState state) =>
        JsonSerializer.Serialize(new
        {
            clientId,
            command.GroupId,
            command.TrainingDate,
            State = state.ToString()
        }, SerializerOptions);

    private static string SerializeMembershipState(Guid clientId, ClientMembershipSnapshotResult membership) =>
        JsonSerializer.Serialize(new
        {
            membership.Id,
            clientId,
            membership.SaleId,
            MembershipType = membership.MembershipType.ToString(),
            membership.PurchaseDate,
            membership.ExpirationDate,
            membership.PaymentAmount,
            membership.IsPaid,
            membership.SingleVisitUsed,
            membership.PaidByUserId,
            membership.PaidAt,
            ChangeReason = membership.ChangeReason.ToString(),
            membership.ChangedByUserId,
            membership.ValidFrom,
            membership.ValidTo,
            membership.CreatedAt
        }, SerializerOptions);
}
