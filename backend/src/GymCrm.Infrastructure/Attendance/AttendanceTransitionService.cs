using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Infrastructure.AttendanceFeatures;

internal sealed class AttendanceTransitionService(
    GymCrmDbContext dbContext,
    TimeProvider timeProvider) : IAttendanceTransitionService
{
    public async Task<AttendanceTransitionRunResult> EnsureRunAsync(
        DateOnly cutoverDate,
        string sourceSchemaVersion,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sourceSchemaVersion))
        {
            return AttendanceTransitionRunResult.Failure(AttendanceTransitionRunError.SourceSchemaVersionMissing);
        }

        var normalizedSource = sourceSchemaVersion.Trim();
        var existingRun = await dbContext.AttendanceTransitionRuns
            .SingleOrDefaultAsync(run => run.SourceSchemaVersion == normalizedSource, cancellationToken);
        if (existingRun is not null && existingRun.CutoverDate != cutoverDate)
        {
            return AttendanceTransitionRunResult.Failure(AttendanceTransitionRunError.CutoverDateMismatch);
        }

        var now = timeProvider.GetUtcNow();
        var run = existingRun ?? new AttendanceTransitionRun
        {
            Id = Guid.NewGuid(),
            CutoverDate = cutoverDate,
            SourceSchemaVersion = normalizedSource,
            CreatedAt = now,
            UpdatedAt = now
        };
        if (existingRun is null)
        {
            dbContext.AttendanceTransitionRuns.Add(run);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var invalidLegacyGroups = await EnsureCurrentSeriesFromLegacyGroupsAsync(cutoverDate, now, cancellationToken);
        await RebuildReportAsync(run, now, invalidLegacyGroups, cancellationToken);
        await TransitionLegacyTrainerSubstitutionsAsync(run, now, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        var unresolved = await dbContext.AttendanceTransitionReportItems
            .CountAsync(item =>
                item.RunId == run.Id &&
                item.ResolutionStatus == AttendanceTransitionResolutionStatus.Unresolved,
                cancellationToken);

        run.Status = unresolved == 0
            ? AttendanceTransitionRunStatus.ReadyForActivation
            : AttendanceTransitionRunStatus.Blocked;
        run.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        return AttendanceTransitionRunResult.Success(run.Id, unresolved);
    }

    private async Task<IReadOnlyList<InvalidLegacyGroupSchedule>> EnsureCurrentSeriesFromLegacyGroupsAsync(
        DateOnly cutoverDate,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var groups = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => !dbContext.LessonSeries.Any(series => series.GroupId == group.Id))
            .OrderBy(group => group.Id)
            .ToArrayAsync(cancellationToken);

        var invalidGroups = new List<InvalidLegacyGroupSchedule>();
        foreach (var group in groups)
        {
            var weekdays = group.Weekdays.Distinct().OrderBy(value => value).ToArray();
            if (weekdays.Length == 0 ||
                weekdays.Any(weekday => weekday is < 1 or > 7) ||
                group.HallId == Guid.Empty ||
                group.DurationMinutes is < 1 or > 180)
            {
                invalidGroups.Add(new InvalidLegacyGroupSchedule(group.Id, "legacy-group-schedule-template-invalid"));
                continue;
            }

            var seriesId = Guid.NewGuid();
            var versionId = Guid.NewGuid();
            var version = new LessonScheduleRuleVersion
            {
                Id = versionId,
                LessonSeriesId = seriesId,
                VersionNumber = 1,
                EffectiveFrom = cutoverDate,
                CreatedAt = now
            };
            foreach (var weekday in weekdays)
            {
                version.Slots.Add(new LessonScheduleSlot
                {
                    Id = Guid.NewGuid(),
                    LessonScheduleRuleVersionId = versionId,
                    SlotLineageId = Guid.NewGuid(),
                    IsoWeekday = weekday,
                    StartTime = group.TrainingStartTime,
                    DurationMinutes = group.DurationMinutes,
                    HallId = group.HallId,
                    CreatedAt = now
                });
            }

            dbContext.LessonSeries.Add(new LessonSeries
            {
                Id = seriesId,
                GroupId = group.Id,
                StartsOn = cutoverDate,
                Version = 1,
                CreatedAt = now,
                UpdatedAt = now,
                RuleVersions = { version }
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return invalidGroups;
    }

    public async Task<AttendanceTransitionActivationResult> ValidateActivationAsync(
        Guid runId,
        CancellationToken cancellationToken)
    {
        var unresolved = await dbContext.AttendanceTransitionReportItems
            .CountAsync(item =>
                item.RunId == runId &&
                item.ResolutionStatus == AttendanceTransitionResolutionStatus.Unresolved,
                cancellationToken);

        return new AttendanceTransitionActivationResult(unresolved == 0, unresolved);
    }

    public async Task<AttendanceTransitionResolutionResult> ResolveReportItemAsync(
        ResolveAttendanceTransitionReportItemCommand command,
        CancellationToken cancellationToken)
    {
        if (command.ReportItemId == Guid.Empty ||
            command.OperatorUserId == Guid.Empty ||
            (command.TargetLessonOccurrenceId is null && command.LegacyOccurrence is null) ||
            (command.TargetLessonOccurrenceId is not null && command.LegacyOccurrence is not null) ||
            command.TargetLessonOccurrenceId == Guid.Empty ||
            command.AttendanceRowIds.Count == 0 ||
            command.AttendanceRowIds.Any(id => id == Guid.Empty) ||
            command.AttendanceRowIds.Distinct().Count() != command.AttendanceRowIds.Count ||
            (command.LegacyOccurrence is not null && !IsValidLegacyOccurrenceCommand(command.LegacyOccurrence)))
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var item = await dbContext.AttendanceTransitionReportItems
            .Include(candidate => candidate.RowResolutions)
            .SingleOrDefaultAsync(candidate => candidate.Id == command.ReportItemId, cancellationToken);
        if (item is null)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.ReportItemMissing);
        }

        var reportRowIds = DeserializeRowIds(item.AttendanceRowIdsJson);
        if (!command.AttendanceRowIds.All(reportRowIds.Contains))
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.AttendanceRowsOutsideReport);
        }

        if (command.LegacyOccurrence is not null &&
            !await IsValidLegacyOccurrenceProvenanceAsync(command.LegacyOccurrence, item, cancellationToken))
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var resolutionKind = command.LegacyOccurrence is null ? "ExistingOccurrence" : "LegacyAttendance";
        var digest = CreateResolutionDigest(command, resolutionKind);
        var existingMappings = await dbContext.AttendanceTransitionRowResolutions
            .Where(resolution => command.AttendanceRowIds.Contains(resolution.AttendanceRowId))
            .ToArrayAsync(cancellationToken);
        if (existingMappings.Length > 0)
        {
            var allRepeat = existingMappings.Length == command.AttendanceRowIds.Count &&
                existingMappings.All(resolution =>
                    resolution.ReportItemId == item.Id &&
                    resolution.ResolutionDigest == digest &&
                    (command.LegacyOccurrence is not null ||
                     resolution.TargetLessonOccurrenceId == command.TargetLessonOccurrenceId));
            if (!allRepeat)
            {
                return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.AttendanceRowAlreadyMapped);
            }

            var remainingRepeat = reportRowIds.Count - await CountMappedReportRowsAsync(item.Id, cancellationToken);
            return AttendanceTransitionResolutionResult.Success(remainingRepeat == 0, remainingRepeat);
        }

        await using var transaction = await BeginTransactionIfRelationalAsync(cancellationToken);
        var targetOccurrenceId = command.TargetLessonOccurrenceId ??
            await CreateLegacyOccurrenceAsync(command.LegacyOccurrence!, command.OperatorUserId, item, cancellationToken);
        if (command.TargetLessonOccurrenceId is not null &&
            !await dbContext.LessonOccurrences.AnyAsync(
                occurrence => occurrence.Id == targetOccurrenceId,
                cancellationToken))
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.TargetOccurrenceMissing);
        }

        var updatedRows = await ApplyRowResolutionAsync(targetOccurrenceId, command.AttendanceRowIds, cancellationToken);
        if (updatedRows != command.AttendanceRowIds.Count)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.AttendanceRowAlreadyMapped);
        }

        var now = timeProvider.GetUtcNow();
        foreach (var rowId in command.AttendanceRowIds.OrderBy(id => id))
        {
            dbContext.AttendanceTransitionRowResolutions.Add(new AttendanceTransitionRowResolution
            {
                Id = Guid.NewGuid(),
                RunId = item.RunId,
                ReportItemId = item.Id,
                AttendanceRowId = rowId,
                TargetLessonOccurrenceId = targetOccurrenceId,
                ResolutionKind = resolutionKind,
                ResolvedByUserId = command.OperatorUserId,
                ResolvedAt = now,
                OperatorComment = command.OperatorComment,
                ResolutionDigest = digest
            });
            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = command.OperatorUserId,
                ActionType = "AttendanceTransitionRowResolved",
                EntityType = "AttendanceTransitionReportItem",
                EntityId = item.Id.ToString("D"),
                Description = global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AttendanceTransitionServiceLine2466f693631,
                Source = "Maintenance",
                NewValueJson = JsonSerializer.Serialize(new
                {
                    item.RunId,
                    ReportItemId = item.Id,
                    AttendanceRowId = rowId,
                    TargetLessonOccurrenceId = targetOccurrenceId,
                    resolutionKind,
                    command.OperatorComment
                }),
                CreatedAt = now
            });
        }

        var mappedRows = await CountMappedReportRowsAsync(item.Id, cancellationToken) + command.AttendanceRowIds.Count;
        var remaining = Math.Max(0, reportRowIds.Count - mappedRows);
        item.TargetLessonOccurrenceId = remaining == 0 &&
            await HasSingleTargetOccurrenceAsync(item.Id, targetOccurrenceId, cancellationToken)
            ? targetOccurrenceId
            : null;
        item.OperatorComment = command.OperatorComment;
        item.UpdatedAt = now;
        if (remaining == 0)
        {
            item.ResolutionStatus = AttendanceTransitionResolutionStatus.Resolved;
            item.ResolutionKind = item.TargetLessonOccurrenceId.HasValue ? resolutionKind : "Partitioned";
            item.ResolvedByUserId = command.OperatorUserId;
            item.ResolvedAt = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        await UpdateRunStatusAsync(item.RunId, now, cancellationToken);
        return AttendanceTransitionResolutionResult.Success(remaining == 0, remaining);
    }

    public async Task<AttendanceTransitionResolutionResult> ResolveTrainerSubstitutionReportItemAsync(
        ResolveTrainerSubstitutionTransitionReportItemCommand command,
        CancellationToken cancellationToken)
    {
        if (command.ReportItemId == Guid.Empty ||
            command.OperatorUserId == Guid.Empty ||
            command.TargetLessonOccurrenceId == Guid.Empty ||
            command.ReplacedTrainerId == Guid.Empty ||
            command.SubstituteTrainerId == Guid.Empty ||
            command.SourceGroupTrainerSubstitutionId == Guid.Empty ||
            command.ReplacedTrainerId == command.SubstituteTrainerId)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var item = await dbContext.AttendanceTransitionReportItems
            .SingleOrDefaultAsync(candidate => candidate.Id == command.ReportItemId, cancellationToken);
        if (item is null)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.ReportItemMissing);
        }

        if (item.RowCount != 0 ||
            !item.GroupId.HasValue ||
            !item.TrainingDate.HasValue ||
            !item.ReasonCode.StartsWith("trainer-substitution-", StringComparison.Ordinal))
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var occurrence = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(candidate => candidate.Id == command.TargetLessonOccurrenceId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.GroupId,
                candidate.LessonDate
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (occurrence is null ||
            occurrence.GroupId != item.GroupId.Value ||
            occurrence.LessonDate != item.TrainingDate.Value)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.TargetOccurrenceMissing);
        }

        var sourceSubstitution = await dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .Where(candidate => candidate.Id == command.SourceGroupTrainerSubstitutionId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.GroupId,
                candidate.SubstituteTrainerId,
                candidate.StartsOn,
                candidate.EndsOn,
                candidate.CancelledAt
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (sourceSubstitution is null ||
            sourceSubstitution.CancelledAt is not null ||
            sourceSubstitution.GroupId != item.GroupId.Value ||
            sourceSubstitution.SubstituteTrainerId != command.SubstituteTrainerId ||
            sourceSubstitution.StartsOn > item.TrainingDate.Value ||
            sourceSubstitution.EndsOn < item.TrainingDate.Value)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var assignmentExists = await dbContext.GroupTrainerAssignments
            .AsNoTracking()
            .AnyAsync(assignment =>
                assignment.GroupId == item.GroupId.Value &&
                assignment.TrainerId == command.ReplacedTrainerId &&
                assignment.ValidFrom <= item.TrainingDate.Value &&
                (assignment.ValidTo == null || assignment.ValidTo >= item.TrainingDate.Value),
                cancellationToken);
        if (!assignmentExists)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.InvalidRequest);
        }

        var existing = await dbContext.LessonOccurrenceTrainerSubstitutions
            .Where(candidate =>
                candidate.LessonOccurrenceId == command.TargetLessonOccurrenceId &&
                (candidate.SourceGroupTrainerSubstitutionId == command.SourceGroupTrainerSubstitutionId ||
                 candidate.ReplacedTrainerId == command.ReplacedTrainerId))
            .ToArrayAsync(cancellationToken);
        var identical = existing.SingleOrDefault(candidate =>
            candidate.LessonOccurrenceId == command.TargetLessonOccurrenceId &&
            candidate.ReplacedTrainerId == command.ReplacedTrainerId &&
            candidate.SubstituteTrainerId == command.SubstituteTrainerId &&
            candidate.SourceGroupTrainerSubstitutionId == command.SourceGroupTrainerSubstitutionId &&
            candidate.CancelledAt == null);
        if (existing.Length > 0 && identical is null)
        {
            return AttendanceTransitionResolutionResult.Failure(AttendanceTransitionResolutionError.AttendanceRowAlreadyMapped);
        }

        var now = timeProvider.GetUtcNow();
        if (identical is not null)
        {
            await MarkTrainerSubstitutionReportResolvedAsync(item, command, now, cancellationToken);
            await UpdateRunStatusAsync(item.RunId, now, cancellationToken);
            return AttendanceTransitionResolutionResult.Success(true, 0);
        }

        await using var transaction = await BeginTransactionIfRelationalAsync(cancellationToken);
        dbContext.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            LessonOccurrenceId = command.TargetLessonOccurrenceId,
            ReplacedTrainerId = command.ReplacedTrainerId,
            SubstituteTrainerId = command.SubstituteTrainerId,
            CreatedByUserId = command.OperatorUserId,
            SourceGroupTrainerSubstitutionId = command.SourceGroupTrainerSubstitutionId,
            CreatedAt = now,
            UpdatedAt = now
        });
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = command.OperatorUserId,
            ActionType = "AttendanceTransitionTrainerSubstitutionResolved",
            EntityType = "AttendanceTransitionReportItem",
            EntityId = item.Id.ToString("D"),
            Description = global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AttendanceTransitionServiceLine414C059f91d,
            Source = "Maintenance",
            NewValueJson = JsonSerializer.Serialize(new
            {
                item.RunId,
                ReportItemId = item.Id,
                command.TargetLessonOccurrenceId,
                command.ReplacedTrainerId,
                command.SubstituteTrainerId,
                command.SourceGroupTrainerSubstitutionId,
                command.OperatorComment
            }),
            CreatedAt = now
        });
        await MarkTrainerSubstitutionReportResolvedAsync(item, command, now, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        await UpdateRunStatusAsync(item.RunId, now, cancellationToken);
        return AttendanceTransitionResolutionResult.Success(true, 0);
    }

    private async Task RebuildReportAsync(
        AttendanceTransitionRun run,
        DateTimeOffset now,
        IReadOnlyList<InvalidLegacyGroupSchedule> invalidLegacyGroups,
        CancellationToken cancellationToken)
    {
        var existingItems = await dbContext.AttendanceTransitionReportItems
            .Where(item => item.RunId == run.Id)
            .ToArrayAsync(cancellationToken);
        var existingByKey = existingItems
            .Where(item => item.GroupId.HasValue && item.TrainingDate.HasValue)
            .ToDictionary(item => (item.GroupId!.Value, item.TrainingDate!.Value));

        var unmappedGroups = await LoadUnmappedGroupsAsync(cancellationToken);

        foreach (var group in unmappedGroups.OrderBy(item => item.TrainingDate).ThenBy(item => item.GroupId))
        {
            if (existingByKey.TryGetValue((group.GroupId, group.TrainingDate), out var existing))
            {
                var currentRows = DeserializeRowIds(existing.AttendanceRowIdsJson)
                    .Concat(group.RowIds)
                    .Distinct()
                    .OrderBy(id => id)
                    .ToArray();
                existing.AttendanceRowIdsJson = JsonSerializer.Serialize(currentRows);
                existing.RowCount = currentRows.Length;
                existing.UpdatedAt = now;
                if (existing.ResolutionStatus == AttendanceTransitionResolutionStatus.Resolved)
                {
                    var mappedCount = await CountMappedReportRowsAsync(existing.Id, cancellationToken);
                    if (mappedCount < currentRows.Length)
                    {
                        existing.ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved;
                        existing.ResolutionKind = null;
                        existing.TargetLessonOccurrenceId = null;
                        existing.ResolvedByUserId = null;
                        existing.ResolvedAt = null;
                    }
                }

                continue;
            }

            dbContext.AttendanceTransitionReportItems.Add(new AttendanceTransitionReportItem
            {
                Id = Guid.NewGuid(),
                RunId = run.Id,
                GroupId = group.GroupId,
                TrainingDate = group.TrainingDate,
                AttendanceRowIdsJson = JsonSerializer.Serialize(group.RowIds),
                RowCount = group.RowIds.Count,
                ReasonCode = "attendance-occurrence-unmapped",
                ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        foreach (var invalidGroup in invalidLegacyGroups.OrderBy(item => item.GroupId))
        {
            var existing = existingItems.SingleOrDefault(item =>
                item.GroupId == invalidGroup.GroupId &&
                item.TrainingDate == null &&
                item.ReasonCode == invalidGroup.ReasonCode);
            if (existing is not null)
            {
                existing.ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved;
                existing.UpdatedAt = now;
                continue;
            }

            dbContext.AttendanceTransitionReportItems.Add(new AttendanceTransitionReportItem
            {
                Id = Guid.NewGuid(),
                RunId = run.Id,
                GroupId = invalidGroup.GroupId,
                TrainingDate = null,
                AttendanceRowIdsJson = "[]",
                RowCount = 0,
                ReasonCode = invalidGroup.ReasonCode,
                ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
    }

    private async Task TransitionLegacyTrainerSubstitutionsAsync(
        AttendanceTransitionRun run,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var substitutions = await dbContext.GroupTrainerSubstitutions
            .AsNoTracking()
            .Where(substitution => substitution.CancelledAt == null)
            .OrderBy(substitution => substitution.GroupId)
            .ThenBy(substitution => substitution.StartsOn)
            .ThenBy(substitution => substitution.Id)
            .ToArrayAsync(cancellationToken);

        foreach (var substitution in substitutions)
        {
            for (var date = substitution.StartsOn; date <= substitution.EndsOn; date = date.AddDays(1))
            {
                var occurrence = await ResolveExactTransitionOccurrenceAsync(substitution.GroupId, date, now, cancellationToken);
                if (!occurrence.Succeeded)
                {
                    await UpsertUnresolvedTransitionReportItemAsync(
                        run,
                        substitution.GroupId,
                        date,
                        occurrence.ReasonCode!,
                        now,
                        cancellationToken);
                    continue;
                }

                var replacedTrainerIds = await dbContext.GroupTrainerAssignments
                    .AsNoTracking()
                    .Where(assignment =>
                        assignment.GroupId == substitution.GroupId &&
                        assignment.ValidFrom <= date &&
                        (assignment.ValidTo == null || assignment.ValidTo >= date) &&
                        assignment.TrainerId != substitution.SubstituteTrainerId)
                    .Select(assignment => assignment.TrainerId)
                    .Distinct()
                    .ToArrayAsync(cancellationToken);
                if (replacedTrainerIds.Length != 1)
                {
                    await UpsertUnresolvedTransitionReportItemAsync(
                        run,
                        substitution.GroupId,
                        date,
                        replacedTrainerIds.Length == 0
                            ? "trainer-substitution-replaced-trainer-missing"
                            : "trainer-substitution-replaced-trainer-ambiguous",
                        now,
                        cancellationToken);
                    continue;
                }

                var occurrenceId = occurrence.LessonOccurrenceId!.Value;
                var replacedTrainerId = replacedTrainerIds[0];
                var alreadyMapped = await dbContext.LessonOccurrenceTrainerSubstitutions
                    .AnyAsync(candidate =>
                        candidate.SourceGroupTrainerSubstitutionId == substitution.Id &&
                        candidate.LessonOccurrenceId == occurrenceId,
                        cancellationToken);
                if (alreadyMapped)
                {
                    await MarkSubstitutionReportItemsResolvedAsync(run.Id, substitution.GroupId, date, occurrenceId, now, cancellationToken);
                    continue;
                }

                var activeReplacementExists = await dbContext.LessonOccurrenceTrainerSubstitutions
                    .AnyAsync(candidate =>
                        candidate.LessonOccurrenceId == occurrenceId &&
                        candidate.ReplacedTrainerId == replacedTrainerId &&
                        candidate.CancelledAt == null,
                        cancellationToken);
                if (activeReplacementExists)
                {
                    await UpsertUnresolvedTransitionReportItemAsync(
                        run,
                        substitution.GroupId,
                        date,
                        "trainer-substitution-active-replacement-conflict",
                        now,
                        cancellationToken);
                    continue;
                }

                dbContext.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    LessonOccurrenceId = occurrenceId,
                    ReplacedTrainerId = replacedTrainerId,
                    SubstituteTrainerId = substitution.SubstituteTrainerId,
                    CreatedByUserId = substitution.CreatedByUserId,
                    SourceGroupTrainerSubstitutionId = substitution.Id,
                    CreatedAt = now,
                    UpdatedAt = now
                });
                dbContext.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = substitution.CreatedByUserId,
                    ActionType = "AttendanceTransitionTrainerSubstitutionMapped",
                    EntityType = "LessonOccurrenceTrainerSubstitution",
                    EntityId = occurrenceId.ToString("D"),
                    Description = global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AttendanceTransitionServiceLine629Feab3b2e,
                    Source = "Maintenance",
                    NewValueJson = JsonSerializer.Serialize(new
                    {
                        run.Id,
                        LegacyGroupTrainerSubstitutionId = substitution.Id,
                        LessonOccurrenceId = occurrenceId,
                        substitution.GroupId,
                        LessonDate = date,
                        ReplacedTrainerId = replacedTrainerId,
                        substitution.SubstituteTrainerId
                    }),
                    CreatedAt = now
                });
                await MarkSubstitutionReportItemsResolvedAsync(run.Id, substitution.GroupId, date, occurrenceId, now, cancellationToken);
            }
        }
    }

    private async Task<TransitionOccurrenceResolution> ResolveExactTransitionOccurrenceAsync(
        Guid groupId,
        DateOnly lessonDate,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var materialized = await dbContext.LessonOccurrences
            .Where(occurrence => occurrence.GroupId == groupId && occurrence.LessonDate == lessonDate)
            .Select(occurrence => occurrence.Id)
            .ToArrayAsync(cancellationToken);
        if (materialized.Length == 1)
        {
            return TransitionOccurrenceResolution.Success(materialized[0]);
        }

        if (materialized.Length > 1)
        {
            return TransitionOccurrenceResolution.Failure("trainer-substitution-occurrence-ambiguous");
        }

        var isoWeekday = lessonDate.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)lessonDate.DayOfWeek;
        var projected = await dbContext.LessonSeries
            .Where(series =>
                series.GroupId == groupId &&
                series.StartsOn <= lessonDate &&
                (series.EndsOn == null || series.EndsOn >= lessonDate))
            .SelectMany(series => series.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= lessonDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= lessonDate))
                .SelectMany(version => version.Slots
                    .Where(slot => slot.IsoWeekday == isoWeekday)
                    .Select(slot => new
                    {
                        Series = series,
                        Version = version,
                        Slot = slot
                    })))
            .ToArrayAsync(cancellationToken);
        if (projected.Length == 0)
        {
            return TransitionOccurrenceResolution.Failure("trainer-substitution-occurrence-missing");
        }

        if (projected.Length > 1)
        {
            return TransitionOccurrenceResolution.Failure("trainer-substitution-occurrence-ambiguous");
        }

        var match = projected[0];
        var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(match.Slot.SlotLineageId, lessonDate);
        dbContext.LessonOccurrences.Add(new LessonOccurrence
        {
            Id = occurrenceId,
            GroupId = groupId,
            HallId = match.Slot.HallId,
            LessonDate = lessonDate,
            StartTime = match.Slot.StartTime,
            DurationMinutes = match.Slot.DurationMinutes,
            SourceLessonSeriesId = match.Series.Id,
            SourceRuleVersionId = match.Version.Id,
            SourceSlotId = match.Slot.Id,
            SourceSlotLineageId = match.Slot.SlotLineageId,
            ProjectedDate = lessonDate,
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = LessonOccurrenceSourceKind.Recurring,
            CreatedAt = now,
            UpdatedAt = now
        });
        return TransitionOccurrenceResolution.Success(occurrenceId);
    }

    private async Task UpsertUnresolvedTransitionReportItemAsync(
        AttendanceTransitionRun run,
        Guid groupId,
        DateOnly trainingDate,
        string reasonCode,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.AttendanceTransitionReportItems
            .SingleOrDefaultAsync(item =>
                item.RunId == run.Id &&
                item.GroupId == groupId &&
                item.TrainingDate == trainingDate &&
                item.ReasonCode == reasonCode,
                cancellationToken);
        if (existing is not null)
        {
            existing.ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved;
            existing.UpdatedAt = now;
            return;
        }

        dbContext.AttendanceTransitionReportItems.Add(new AttendanceTransitionReportItem
        {
            Id = Guid.NewGuid(),
            RunId = run.Id,
            GroupId = groupId,
            TrainingDate = trainingDate,
            AttendanceRowIdsJson = "[]",
            RowCount = 0,
            ReasonCode = reasonCode,
            ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved,
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private async Task MarkSubstitutionReportItemsResolvedAsync(
        Guid runId,
        Guid groupId,
        DateOnly trainingDate,
        Guid targetOccurrenceId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var reportItems = await dbContext.AttendanceTransitionReportItems
            .Where(item =>
                item.RunId == runId &&
                item.GroupId == groupId &&
                item.TrainingDate == trainingDate &&
                item.RowCount == 0 &&
                item.ReasonCode.StartsWith("trainer-substitution-"))
            .ToArrayAsync(cancellationToken);
        foreach (var item in reportItems)
        {
            item.ResolutionStatus = AttendanceTransitionResolutionStatus.Resolved;
            item.ResolutionKind = "AutoMapped";
            item.TargetLessonOccurrenceId = targetOccurrenceId;
            item.UpdatedAt = now;
            item.ResolvedAt = now;
        }
    }

    private async Task MarkTrainerSubstitutionReportResolvedAsync(
        AttendanceTransitionReportItem item,
        ResolveTrainerSubstitutionTransitionReportItemCommand command,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        item.ResolutionStatus = AttendanceTransitionResolutionStatus.Resolved;
        item.ResolutionKind = "TrainerSubstitutionManual";
        item.TargetLessonOccurrenceId = command.TargetLessonOccurrenceId;
        item.ResolvedByUserId = command.OperatorUserId;
        item.ResolvedAt = now;
        item.OperatorComment = command.OperatorComment;
        item.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<UnmappedAttendanceGroup>> LoadUnmappedGroupsAsync(CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            return await dbContext.Attendance
                .AsNoTracking()
                .Where(attendance => attendance.LessonOccurrenceId == Guid.Empty)
                .GroupBy(attendance => new { attendance.GroupId, attendance.TrainingDate })
                .Select(group => new UnmappedAttendanceGroup(
                    group.Key.GroupId,
                    group.Key.TrainingDate,
                    group.Select(attendance => attendance.Id).OrderBy(id => id).ToArray()))
                .ToArrayAsync(cancellationToken);
        }

        var connection = dbContext.Database.GetDbConnection();
        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT "GroupId", "TrainingDate", "Id"
            FROM "Attendance"
            WHERE "LessonOccurrenceId" IS NULL
            ORDER BY "TrainingDate", "GroupId", "Id";
            """;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var groups = new Dictionary<(Guid GroupId, DateOnly TrainingDate), List<Guid>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var key = (reader.GetGuid(0), DateOnly.FromDateTime(reader.GetDateTime(1)));
            if (!groups.TryGetValue(key, out var rowIds))
            {
                rowIds = [];
                groups[key] = rowIds;
            }

            rowIds.Add(reader.GetGuid(2));
        }

        return groups
            .Select(group => new UnmappedAttendanceGroup(group.Key.GroupId, group.Key.TrainingDate, group.Value))
            .ToArray();
    }

    private async Task<int> ApplyRowResolutionAsync(
        Guid targetLessonOccurrenceId,
        IReadOnlyList<Guid> rowIds,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            var rows = await dbContext.Attendance
                .Where(attendance => rowIds.Contains(attendance.Id))
                .ToArrayAsync(cancellationToken);
            var updated = 0;
            foreach (var row in rows.Where(row => row.LessonOccurrenceId == Guid.Empty))
            {
                row.LessonOccurrenceId = targetLessonOccurrenceId;
                updated++;
            }

            return updated;
        }

        var affected = 0;
        foreach (var rowId in rowIds.OrderBy(id => id))
        {
            affected += await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Attendance" SET "LessonOccurrenceId" = {targetLessonOccurrenceId} WHERE "Id" = {rowId} AND "LessonOccurrenceId" IS NULL""",
                cancellationToken);
        }

        return affected;
    }

    private async Task<IReadOnlyList<Guid>> LoadUnmappedRowIdsAsync(
        IReadOnlyCollection<Guid> rowIds,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            return await dbContext.Attendance
                .AsNoTracking()
                .Where(attendance => rowIds.Contains(attendance.Id) && attendance.LessonOccurrenceId == Guid.Empty)
                .Select(attendance => attendance.Id)
                .OrderBy(id => id)
                .ToArrayAsync(cancellationToken);
        }

        var connection = dbContext.Database.GetDbConnection();
        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        var remaining = new List<Guid>();
        foreach (var rowId in rowIds.OrderBy(id => id))
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """SELECT "Id" FROM "Attendance" WHERE "Id" = @rowId AND "LessonOccurrenceId" IS NULL""";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "rowId";
            parameter.Value = rowId;
            command.Parameters.Add(parameter);
            var value = await command.ExecuteScalarAsync(cancellationToken);
            if (value is Guid id)
            {
                remaining.Add(id);
            }
        }

        return remaining;
    }

    private async Task<IDbContextTransaction?> BeginTransactionIfRelationalAsync(CancellationToken cancellationToken) =>
        dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

    private async Task<Guid> CreateLegacyOccurrenceAsync(
        CreateLegacyAttendanceOccurrenceCommand command,
        Guid operatorUserId,
        AttendanceTransitionReportItem item,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var occurrence = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = command.GroupId,
            HallId = command.HallId,
            LessonDate = command.LessonDate,
            StartTime = command.StartTime,
            DurationMinutes = command.DurationMinutes,
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = LessonOccurrenceSourceKind.LegacyAttendance,
            CreatedAt = now,
            UpdatedAt = now
        };
        dbContext.LessonOccurrences.Add(occurrence);
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            UserId = operatorUserId,
            ActionType = "AttendanceTransitionLegacyOccurrenceCreated",
            EntityType = "LessonOccurrence",
            EntityId = occurrence.Id.ToString("D"),
            Description = global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.AttendanceTransitionServiceLine941B4977fca,
            Source = "Maintenance",
            NewValueJson = JsonSerializer.Serialize(new
            {
                occurrence.Id,
                occurrence.GroupId,
                occurrence.LessonDate,
                occurrence.StartTime,
                occurrence.DurationMinutes,
                occurrence.HallId,
                command.Provenance,
                command.PermanentTrainerAssignmentIds,
                command.SubstitutionIds
            }),
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return occurrence.Id;
    }

    private static bool IsValidLegacyOccurrenceCommand(CreateLegacyAttendanceOccurrenceCommand command) =>
        command.GroupId != Guid.Empty &&
        command.HallId != Guid.Empty &&
        command.DurationMinutes is >= 1 and <= 180 &&
        !string.IsNullOrWhiteSpace(command.Provenance) &&
        command.PermanentTrainerAssignmentIds.Count > 0 &&
        command.PermanentTrainerAssignmentIds.All(id => id != Guid.Empty) &&
        command.PermanentTrainerAssignmentIds.Distinct().Count() == command.PermanentTrainerAssignmentIds.Count &&
        command.SubstitutionIds.All(id => id != Guid.Empty) &&
        command.SubstitutionIds.Distinct().Count() == command.SubstitutionIds.Count;

    private async Task<bool> IsValidLegacyOccurrenceProvenanceAsync(
        CreateLegacyAttendanceOccurrenceCommand command,
        AttendanceTransitionReportItem item,
        CancellationToken cancellationToken)
    {
        if ((item.GroupId.HasValue && item.GroupId.Value != command.GroupId) ||
            (item.TrainingDate.HasValue && item.TrainingDate.Value != command.LessonDate))
        {
            return false;
        }

        var assignmentCount = await dbContext.GroupTrainerAssignments
            .CountAsync(assignment =>
                command.PermanentTrainerAssignmentIds.Contains(assignment.Id) &&
                assignment.GroupId == command.GroupId &&
                assignment.ValidFrom <= command.LessonDate &&
                (assignment.ValidTo == null || assignment.ValidTo >= command.LessonDate),
                cancellationToken);
        if (assignmentCount != command.PermanentTrainerAssignmentIds.Count)
        {
            return false;
        }

        var substitutionCount = await dbContext.GroupTrainerSubstitutions
            .CountAsync(substitution =>
                command.SubstitutionIds.Contains(substitution.Id) &&
                substitution.GroupId == command.GroupId &&
                substitution.StartsOn <= command.LessonDate &&
                substitution.EndsOn >= command.LessonDate &&
                substitution.CancelledAt == null,
                cancellationToken);
        return substitutionCount == command.SubstitutionIds.Count;
    }

    private async Task<int> CountMappedReportRowsAsync(Guid reportItemId, CancellationToken cancellationToken) =>
        await dbContext.AttendanceTransitionRowResolutions
            .Where(resolution => resolution.ReportItemId == reportItemId)
            .Select(resolution => resolution.AttendanceRowId)
            .Distinct()
            .CountAsync(cancellationToken);

    private async Task<bool> HasSingleTargetOccurrenceAsync(
        Guid reportItemId,
        Guid targetLessonOccurrenceId,
        CancellationToken cancellationToken)
    {
        var existingTargets = await dbContext.AttendanceTransitionRowResolutions
            .Where(resolution => resolution.ReportItemId == reportItemId)
            .Select(resolution => resolution.TargetLessonOccurrenceId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
        return existingTargets.All(id => id == targetLessonOccurrenceId);
    }

    private async Task UpdateRunStatusAsync(Guid runId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var unresolved = await dbContext.AttendanceTransitionReportItems
            .CountAsync(item =>
                item.RunId == runId &&
                item.ResolutionStatus == AttendanceTransitionResolutionStatus.Unresolved,
                cancellationToken);
        var run = await dbContext.AttendanceTransitionRuns.SingleAsync(item => item.Id == runId, cancellationToken);
        run.Status = unresolved == 0
            ? AttendanceTransitionRunStatus.ReadyForActivation
            : AttendanceTransitionRunStatus.Blocked;
        run.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string CreateResolutionDigest(
        ResolveAttendanceTransitionReportItemCommand command,
        string resolutionKind)
    {
        var payload = new
        {
            resolutionKind,
            command.ReportItemId,
            command.TargetLessonOccurrenceId,
            Rows = command.AttendanceRowIds.OrderBy(id => id).ToArray(),
            command.LegacyOccurrence?.GroupId,
            command.LegacyOccurrence?.LessonDate,
            command.LegacyOccurrence?.StartTime,
            command.LegacyOccurrence?.DurationMinutes,
            command.LegacyOccurrence?.HallId,
            command.LegacyOccurrence?.Provenance,
            PermanentTrainerAssignmentIds = command.LegacyOccurrence?.PermanentTrainerAssignmentIds.OrderBy(id => id).ToArray(),
            SubstitutionIds = command.LegacyOccurrence?.SubstitutionIds.OrderBy(id => id).ToArray()
        };
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(payload)));
    }

    private static IReadOnlySet<Guid> DeserializeRowIds(string value)
    {
        return JsonSerializer.Deserialize<Guid[]>(value)?.ToHashSet() ?? new HashSet<Guid>();
    }

    private sealed record UnmappedAttendanceGroup(
        Guid GroupId,
        DateOnly TrainingDate,
        IReadOnlyList<Guid> RowIds);

    private sealed record InvalidLegacyGroupSchedule(
        Guid GroupId,
        string ReasonCode);

    private sealed record TransitionOccurrenceResolution(
        Guid? LessonOccurrenceId,
        string? ReasonCode)
    {
        public bool Succeeded => LessonOccurrenceId.HasValue;

        public static TransitionOccurrenceResolution Success(Guid lessonOccurrenceId) =>
            new(lessonOccurrenceId, null);

        public static TransitionOccurrenceResolution Failure(string reasonCode) =>
            new(null, reasonCode);
    }
}
