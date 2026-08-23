using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Infrastructure.AttendanceFeatures;

internal sealed class AttendanceService(
    GymCrmDbContext dbContext,
    IClientMembershipService clientMembershipService,
    IAuditLogService auditLogService,
    IAttendanceDatePolicy attendanceDatePolicy,
    IEffectiveGroupAssignmentService effectiveGroupAssignmentService,
    IClientMembershipEntitlementResolver entitlementResolver,
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

        var actorRole = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == command.MarkedByUserId && user.IsActive)
            .Select(user => (UserRole?)user.Role)
            .SingleOrDefaultAsync(cancellationToken);
        if (!actorRole.HasValue)
        {
            return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.Forbidden);
        }

        if (!attendanceDatePolicy.IsAllowed(actorRole.Value, command.TrainingDate))
        {
            return command.TrainingDate > attendanceDatePolicy.GetWindow(actorRole.Value).MaxTrainingDate
                ? AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.TrainingDateInFuture)
                : AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.TrainingDateUnavailable);
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
            var lesson = await ResolveLessonForSaveAsync(command, cancellationToken);
            if (lesson is null)
            {
                if (ownedTransaction is not null)
                {
                    await ownedTransaction.RollbackAsync(cancellationToken);
                }

                return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.LessonOccurrenceMissing);
            }

            if (lesson.Status != LessonOccurrenceStatus.Scheduled)
            {
                if (ownedTransaction is not null)
                {
                    await ownedTransaction.RollbackAsync(cancellationToken);
                }

                return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.LessonOccurrenceUnavailable);
            }

            await LockAttendanceAuthorizationRowsAsync(command.MarkedByUserId, lesson.BranchId, lesson.GroupId, cancellationToken);

            var authorization = await EvaluateLockedAuthorizationAsync(
                command.MarkedByUserId,
                lesson.GroupId,
                lesson.LessonDate,
                cancellationToken);
            if (authorization == AttendanceBatchMutationError.Forbidden ||
                authorization == AttendanceBatchMutationError.TrainingDateInFuture ||
                authorization == AttendanceBatchMutationError.TrainingDateUnavailable)
            {
                if (ownedTransaction is not null)
                {
                    await ownedTransaction.RollbackAsync(cancellationToken);
                }

                return AttendanceBatchMutationResult.Failure(authorization);
            }

            var requestedClientIds = command.Marks.Select(mark => mark.ClientId).Order().ToArray();
            var clientNames = requestedClientIds.Length == 0
                ? new Dictionary<Guid, string>()
                : await dbContext.ClientGroups
                    .AsNoTracking()
                    .Where(clientGroup =>
                        clientGroup.GroupId == lesson.GroupId &&
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
                if (ownedTransaction is not null)
                {
                    await ownedTransaction.RollbackAsync(cancellationToken);
                }

                return AttendanceBatchMutationResult.Failure(
                    AttendanceBatchMutationError.ClientOutsideGroup,
                    new AttendanceBatchSaveResult(command.LessonOccurrenceId, lesson.GroupId, lesson.LessonDate, [], [], [], invalidClientIds));
            }

            await LockAttendanceClientMembershipRowsAsync(requestedClientIds, cancellationToken);

            var existingEntries = requestedClientIds.Length == 0
            ? new Dictionary<Guid, AttendanceEntry>()
                : await dbContext.Attendance
                    .Where(attendance =>
                    attendance.LessonOccurrenceId == command.LessonOccurrenceId &&
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
                        LessonOccurrenceId = command.LessonOccurrenceId,
                        GroupId = lesson.GroupId,
                        TrainingDate = lesson.LessonDate,
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
                    var entitlement = await entitlementResolver.ResolveAsync(
                        mark.ClientId,
                        lesson.GroupId,
                        lesson.LessonDate,
                        cancellationToken);
                    if (entitlement.Status == ClientMembershipEntitlementResolutionStatus.InvariantConflict)
                    {
                        if (ownedTransaction is not null)
                        {
                            await ownedTransaction.RollbackAsync(cancellationToken);
                        }

                        return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.MembershipEntitlementInvariantConflict);
                    }

                    if (entitlement.Status == ClientMembershipEntitlementResolutionStatus.Found)
                    {
                        AddAttendanceEntitlementSnapshots(entry!, entitlement, now);
                    }

                    var writeOff = await clientMembershipService.WriteOffSingleVisitAsync(
                        mark.ClientId,
                        new WriteOffSingleVisitCommand(command.MarkedByUserId, lesson.LessonDate, lesson.GroupId),
                        cancellationToken);
                    if (writeOff.Status == SingleVisitWriteOffStatus.MembershipEntitlementInvariantConflict)
                    {
                        if (ownedTransaction is not null)
                        {
                            await ownedTransaction.RollbackAsync(cancellationToken);
                        }

                        return AttendanceBatchMutationResult.Failure(AttendanceBatchMutationError.MembershipEntitlementInvariantConflict);
                    }

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
            await WriteDomainAuditsAsync(command, lesson.GroupName, clientNames, changes, writeOffs, restores, cancellationToken);

            if (ownedTransaction is not null)
            {
                await ownedTransaction.CommitAsync(cancellationToken);
            }
            return AttendanceBatchMutationResult.Success(new AttendanceBatchSaveResult(
                command.LessonOccurrenceId,
                lesson.GroupId,
                lesson.LessonDate,
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

    private async Task<AttendanceLessonForSave?> ResolveLessonForSaveAsync(
        SaveAttendanceCommand command,
        CancellationToken cancellationToken)
    {
        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence => occurrence.Id == command.LessonOccurrenceId)
            .Select(occurrence => new AttendanceLessonForSave(
                occurrence.Id,
                occurrence.GroupId,
                occurrence.Group.Name,
                occurrence.Group.BranchId,
                occurrence.LessonDate,
                occurrence.StartTime,
                occurrence.DurationMinutes,
                occurrence.HallId,
                occurrence.Status))
            .SingleOrDefaultAsync(cancellationToken);
        if (materialized is not null)
        {
            return materialized.GroupId == command.GroupId && materialized.LessonDate == command.TrainingDate
                ? materialized
                : null;
        }

        var weekday = ToIsoWeekday(command.TrainingDate);
        var projectedSeries = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(series =>
                series.GroupId == command.GroupId &&
                series.StartsOn <= command.TrainingDate &&
                (series.EndsOn == null || series.EndsOn >= command.TrainingDate))
            .Include(series => series.Group)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        var projectedMatch = projectedSeries
            .SelectMany(series => series.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= command.TrainingDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= command.TrainingDate))
                .SelectMany(version => version.Slots
                    .Where(slot => slot.IsoWeekday == weekday)
                    .Select(slot => new
                    {
                        Series = series,
                        Version = version,
                        Slot = slot
                    })))
            .SingleOrDefault(candidate => LessonOccurrenceIdPolicy.CreateRecurring(candidate.Slot.SlotLineageId, command.TrainingDate) == command.LessonOccurrenceId);
        if (projectedMatch is not null)
        {
            var now = timeProvider.GetUtcNow();
            dbContext.LessonOccurrences.Add(new LessonOccurrence
            {
                Id = command.LessonOccurrenceId,
                GroupId = command.GroupId,
                LessonDate = command.TrainingDate,
                StartTime = projectedMatch.Slot.StartTime,
                DurationMinutes = projectedMatch.Slot.DurationMinutes,
                HallId = projectedMatch.Slot.HallId,
                SourceLessonSeriesId = projectedMatch.Series.Id,
                SourceRuleVersionId = projectedMatch.Version.Id,
                SourceSlotId = projectedMatch.Slot.Id,
                SourceSlotLineageId = projectedMatch.Slot.SlotLineageId,
                ProjectedDate = command.TrainingDate,
                Status = LessonOccurrenceStatus.Scheduled,
                SourceKind = LessonOccurrenceSourceKind.Recurring,
                CreatedAt = now,
                UpdatedAt = now
            });

            return new AttendanceLessonForSave(
                command.LessonOccurrenceId,
                command.GroupId,
                projectedMatch.Series.Group.Name,
                projectedMatch.Series.Group.BranchId,
                command.TrainingDate,
                projectedMatch.Slot.StartTime,
                projectedMatch.Slot.DurationMinutes,
                projectedMatch.Slot.HallId,
                LessonOccurrenceStatus.Scheduled);
        }

        return null;
    }

    private void AddAttendanceEntitlementSnapshots(
        AttendanceEntry entry,
        ClientMembershipEntitlementResolution entitlement,
        DateTimeOffset now)
    {
        foreach (var target in entitlement.TargetGroups.OrderBy(target => target.Position))
        {
            dbContext.AttendanceEntitlementTargetSnapshots.Add(new GymCrm.Domain.Attendance.AttendanceEntitlementTargetSnapshot
            {
                Id = Guid.NewGuid(),
                AttendanceId = entry.Id,
                ClientId = entitlement.ClientId,
                FactualGroupId = entitlement.GroupId,
                TrainingDate = entitlement.TrainingDate,
                MembershipId = entitlement.MembershipId,
                SaleId = entitlement.SaleId,
                CoverageKind = entitlement.CoverageKind!.Value,
                TargetGroupId = target.GroupId,
                TargetBranchId = target.BranchId,
                Position = target.Position,
                Provenance = "Write",
                CreatedAt = now
            });
        }
    }

    private async Task LockAttendanceAuthorizationRowsAsync(
        Guid actorId,
        Guid branchId,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Branches" WHERE "Id" = {branchId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Users" WHERE "Id" = {actorId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "AdministratorAttendanceGroupGrants" WHERE "AdministratorId" = {actorId} AND "GroupId" = {groupId} FOR UPDATE""",
            cancellationToken);
    }

    private async Task LockAttendanceClientMembershipRowsAsync(
        IReadOnlyList<Guid> clientIds,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        foreach (var clientId in clientIds.Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR UPDATE""",
                cancellationToken);
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL ORDER BY "Id" FOR UPDATE""",
                cancellationToken);
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "ClientMembershipTargetGroups" WHERE "ClientMembershipId" IN (SELECT "Id" FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL) ORDER BY "ClientMembershipId", "Position" FOR UPDATE""",
                cancellationToken);
        }
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private async Task<AttendanceBatchMutationError> EvaluateLockedAuthorizationAsync(
        Guid actorId,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken)
    {
        var actor = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == actorId && user.IsActive)
            .Select(user => new { user.Id, user.Role, user.BranchId })
            .SingleOrDefaultAsync(cancellationToken);
        if (actor is null)
        {
            return AttendanceBatchMutationError.Forbidden;
        }

        if (!attendanceDatePolicy.IsAllowed(actor.Role, trainingDate))
        {
            return trainingDate > attendanceDatePolicy.GetWindow(actor.Role).MaxTrainingDate
                ? AttendanceBatchMutationError.TrainingDateInFuture
                : AttendanceBatchMutationError.TrainingDateUnavailable;
        }

        return actor.Role switch
        {
            UserRole.HeadCoach or UserRole.SuperAdministrator => AttendanceBatchMutationError.None,
            UserRole.Coach => await effectiveGroupAssignmentService.HasEffectiveAssignmentAsync(
                    actorId,
                    groupId,
                    cancellationToken)
                ? AttendanceBatchMutationError.None
                : AttendanceBatchMutationError.Forbidden,
            UserRole.Administrator => await dbContext.AdministratorAttendanceGroupGrants
                .AsNoTracking()
                .AnyAsync(
                    grant =>
                        grant.GroupId == groupId &&
                        grant.AdministratorId == actorId &&
                        grant.Administrator.Role == UserRole.Administrator &&
                        grant.Administrator.IsActive &&
                        grant.Administrator.BranchId == grant.BranchId &&
                        !grant.Branch.IsArchived &&
                        grant.Group.BranchId == grant.BranchId,
                    cancellationToken)
                ? AttendanceBatchMutationError.None
                : AttendanceBatchMutationError.Forbidden,
            _ => AttendanceBatchMutationError.Forbidden
        };
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
        command.LessonOccurrenceId != Guid.Empty &&
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
            command.LessonOccurrenceId,
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
            membership.MembershipCatalogItemId,
            membership.MembershipName,
            BehaviorKind = membership.BehaviorKind.ToString(),
            PricingMode = membership.PricingMode.ToString(),
            membership.GrossAmount,
            membership.CatalogPrice,
            membership.IndividualValidFrom,
            membership.IndividualValidTo,
            membership.ProfessionalComment,
            membership.PurchaseDate,
            membership.PaymentDate,
            membership.ExpirationDate,
            membership.SingleVisitUsed,
            membership.PaymentRecordedByUserId,
            membership.PaymentRecordedAt,
            ChangeReason = membership.ChangeReason.ToString(),
            membership.ChangedByUserId,
            membership.ValidFrom,
            membership.ValidTo,
            membership.CreatedAt
        }, SerializerOptions);

    private sealed record AttendanceLessonForSave(
        Guid LessonOccurrenceId,
        Guid GroupId,
        string GroupName,
        Guid BranchId,
        DateOnly LessonDate,
        TimeOnly StartTime,
        int DurationMinutes,
        Guid HallId,
        LessonOccurrenceStatus Status);
}
