using GymCrm.Application.Attendance;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.AttendanceFeatures;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Tests;

public sealed class AttendanceTransitionServiceTests
{
    [Fact]
    public async Task Cutover_date_mismatch_fails_before_report_writes()
    {
        var groupId = Guid.NewGuid();
        var hallId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.TrainingGroups.Add(new TrainingGroup
        {
            Id = groupId,
            BranchId = Guid.NewGuid(),
            HallId = hallId,
            GroupTypeId = Guid.NewGuid(),
            Name = "Legacy group",
            TrainingStartTime = new TimeOnly(9, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3],
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var first = await service.EnsureRunAsync(new DateOnly(2026, 8, 23), "legacy-v1", CancellationToken.None);
        var mismatch = await service.EnsureRunAsync(new DateOnly(2026, 8, 24), "legacy-v1", CancellationToken.None);

        Assert.True(first.Succeeded);
        Assert.Equal(AttendanceTransitionRunError.CutoverDateMismatch, mismatch.Error);
        Assert.Single(await dbContext.AttendanceTransitionRuns.ToArrayAsync());
        Assert.Empty(await dbContext.AttendanceTransitionReportItems.ToArrayAsync());
        var series = Assert.Single(await dbContext.LessonSeries.Include(item => item.RuleVersions).ThenInclude(version => version.Slots).ToArrayAsync());
        Assert.Equal(new DateOnly(2026, 8, 23), series.StartsOn);
        Assert.Equal([1, 3], series.RuleVersions.Single().Slots.OrderBy(slot => slot.IsoWeekday).Select(slot => slot.IsoWeekday).ToArray());
    }

    [Fact]
    public async Task Invalid_legacy_group_template_is_reported_and_blocks_activation()
    {
        await using var dbContext = CreateDbContext();
        dbContext.TrainingGroups.Add(new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            HallId = Guid.NewGuid(),
            GroupTypeId = Guid.NewGuid(),
            Name = "Broken legacy group",
            TrainingStartTime = new TimeOnly(9, 0),
            DurationMinutes = 60,
            Weekdays = [],
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var result = await service.EnsureRunAsync(new DateOnly(2026, 8, 23), "legacy-v1", CancellationToken.None);
        var activation = await service.ValidateActivationAsync(result.RunId!.Value, CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(1, result.UnresolvedCount);
        Assert.False(activation.CanActivate);
        var report = Assert.Single(await dbContext.AttendanceTransitionReportItems.ToArrayAsync());
        Assert.Equal("legacy-group-schedule-template-invalid", report.ReasonCode);
        Assert.Equal(0, report.RowCount);
        Assert.Empty(await dbContext.LessonSeries.ToArrayAsync());
    }

    [Fact]
    public async Task Report_resolution_is_exact_row_idempotent_and_blocks_until_all_rows_are_mapped()
    {
        var groupId = Guid.NewGuid();
        var date = new DateOnly(2026, 8, 23);
        var firstOccurrenceId = Guid.NewGuid();
        var secondOccurrenceId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        var firstRow = CreateUnmappedAttendance(groupId, date);
        var secondRow = CreateUnmappedAttendance(groupId, date);
        dbContext.Attendance.AddRange(firstRow, secondRow);
        dbContext.LessonOccurrences.AddRange(new LessonOccurrence
        {
            Id = firstOccurrenceId,
            GroupId = groupId,
            HallId = Guid.NewGuid(),
            LessonDate = date,
            StartTime = new TimeOnly(9, 0),
            DurationMinutes = 60,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        },
        new LessonOccurrence
        {
            Id = secondOccurrenceId,
            GroupId = groupId,
            HallId = Guid.NewGuid(),
            LessonDate = date,
            StartTime = new TimeOnly(11, 0),
            DurationMinutes = 60,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var first = await service.EnsureRunAsync(date, "legacy-v1", CancellationToken.None);
        var second = await service.EnsureRunAsync(date, "legacy-v1", CancellationToken.None);
        Assert.True(first.Succeeded);
        Assert.True(second.Succeeded);
        Assert.Equal(1, first.UnresolvedCount);
        Assert.Equal(1, second.UnresolvedCount);
        var report = Assert.Single(await dbContext.AttendanceTransitionReportItems.ToArrayAsync());
        Assert.Equal("attendance-occurrence-unmapped", report.ReasonCode);
        Assert.Equal(2, report.RowCount);

        var partial = await service.ResolveReportItemAsync(
            new ResolveAttendanceTransitionReportItemCommand(report.Id, Guid.NewGuid(), firstOccurrenceId, [firstRow.Id], "first partition"),
            CancellationToken.None);
        var afterPartialRerun = await service.EnsureRunAsync(date, "legacy-v1", CancellationToken.None);
        var blocked = await service.ValidateActivationAsync(first.RunId!.Value, CancellationToken.None);
        var complete = await service.ResolveReportItemAsync(
            new ResolveAttendanceTransitionReportItemCommand(report.Id, Guid.NewGuid(), secondOccurrenceId, [secondRow.Id], "second partition"),
            CancellationToken.None);
        var repeat = await service.ResolveReportItemAsync(
            new ResolveAttendanceTransitionReportItemCommand(report.Id, Guid.NewGuid(), secondOccurrenceId, [secondRow.Id], "second partition"),
            CancellationToken.None);
        var ready = await service.ValidateActivationAsync(first.RunId!.Value, CancellationToken.None);

        Assert.True(partial.Succeeded);
        Assert.False(partial.ReportItemResolved);
        Assert.Equal(1, partial.RemainingRowCount);
        Assert.True(afterPartialRerun.Succeeded);
        Assert.Equal(1, afterPartialRerun.UnresolvedCount);
        Assert.False(blocked.CanActivate);
        Assert.True(complete.Succeeded);
        Assert.True(complete.ReportItemResolved);
        Assert.True(repeat.Succeeded);
        Assert.True(repeat.ReportItemResolved);
        Assert.True(ready.CanActivate);
        report = await dbContext.AttendanceTransitionReportItems.SingleAsync();
        Assert.Equal(2, report.RowCount);
        Assert.Equal("Partitioned", report.ResolutionKind);
        Assert.Null(report.TargetLessonOccurrenceId);
        Assert.Equal(2, await dbContext.AttendanceTransitionRowResolutions.CountAsync());
        Assert.Equal(2, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "AttendanceTransitionRowResolved"));
    }

    [Fact]
    public async Task Legacy_trainer_substitution_auto_maps_when_occurrence_and_replaced_trainer_are_exact()
    {
        var date = new DateOnly(2026, 8, 24);
        var groupId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var replacedTrainerId = Guid.NewGuid();
        var substituteTrainerId = Guid.NewGuid();
        var operatorId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        SeedLegacyGroup(dbContext, groupId, date);
        dbContext.LessonOccurrences.Add(CreateOccurrence(occurrenceId, groupId, date, new TimeOnly(9, 0)));
        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = replacedTrainerId,
            ValidFrom = date.AddDays(-7),
            CreatedByUserId = operatorId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        var legacySubstitutionId = Guid.NewGuid();
        dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = legacySubstitutionId,
            GroupId = groupId,
            SubstituteTrainerId = substituteTrainerId,
            StartsOn = date,
            EndsOn = date,
            CreatedByUserId = operatorId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var result = await service.EnsureRunAsync(date, "legacy-v-substitution", CancellationToken.None);
        var repeat = await service.EnsureRunAsync(date, "legacy-v-substitution", CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(0, result.UnresolvedCount);
        Assert.True(repeat.Succeeded);
        Assert.Equal(0, repeat.UnresolvedCount);
        var canonical = Assert.Single(await dbContext.LessonOccurrenceTrainerSubstitutions.ToArrayAsync());
        Assert.Equal(occurrenceId, canonical.LessonOccurrenceId);
        Assert.Equal(replacedTrainerId, canonical.ReplacedTrainerId);
        Assert.Equal(substituteTrainerId, canonical.SubstituteTrainerId);
        Assert.Equal(legacySubstitutionId, canonical.SourceGroupTrainerSubstitutionId);
        Assert.Empty(await dbContext.AttendanceTransitionReportItems.Where(item => item.ResolutionStatus == AttendanceTransitionResolutionStatus.Unresolved).ToArrayAsync());
        Assert.Single(await dbContext.AuditLogs.Where(log => log.ActionType == "AttendanceTransitionTrainerSubstitutionMapped").ToArrayAsync());
    }

    [Fact]
    public async Task Legacy_trainer_substitution_with_two_same_day_occurrences_stays_unresolved()
    {
        var date = new DateOnly(2026, 8, 24);
        var groupId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        SeedLegacyGroup(dbContext, groupId, date);
        dbContext.LessonOccurrences.AddRange(
            CreateOccurrence(Guid.NewGuid(), groupId, date, new TimeOnly(9, 0)),
            CreateOccurrence(Guid.NewGuid(), groupId, date, new TimeOnly(11, 0)));
        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = Guid.NewGuid(),
            ValidFrom = date.AddDays(-7),
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = Guid.NewGuid(),
            StartsOn = date,
            EndsOn = date,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var result = await service.EnsureRunAsync(date, "legacy-v-substitution-ambiguous-occurrence", CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(1, result.UnresolvedCount);
        Assert.Empty(await dbContext.LessonOccurrenceTrainerSubstitutions.ToArrayAsync());
        var report = Assert.Single(await dbContext.AttendanceTransitionReportItems.ToArrayAsync());
        Assert.Equal("trainer-substitution-occurrence-ambiguous", report.ReasonCode);
        Assert.Equal(0, report.RowCount);
    }

    [Fact]
    public async Task Legacy_trainer_substitution_with_multiple_permanent_trainers_stays_unresolved()
    {
        var date = new DateOnly(2026, 8, 24);
        var groupId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        SeedLegacyGroup(dbContext, groupId, date);
        dbContext.LessonOccurrences.Add(CreateOccurrence(Guid.NewGuid(), groupId, date, new TimeOnly(9, 0)));
        dbContext.GroupTrainerAssignments.AddRange(
            new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                TrainerId = Guid.NewGuid(),
                ValidFrom = date.AddDays(-7),
                CreatedByUserId = Guid.NewGuid(),
                CreatedAt = DateTimeOffset.UtcNow
            },
            new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                TrainerId = Guid.NewGuid(),
                ValidFrom = date.AddDays(-7),
                CreatedByUserId = Guid.NewGuid(),
                CreatedAt = DateTimeOffset.UtcNow
            });
        dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = Guid.NewGuid(),
            StartsOn = date,
            EndsOn = date,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var result = await service.EnsureRunAsync(date, "legacy-v-substitution-ambiguous-trainer", CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(1, result.UnresolvedCount);
        Assert.Empty(await dbContext.LessonOccurrenceTrainerSubstitutions.ToArrayAsync());
        var report = Assert.Single(await dbContext.AttendanceTransitionReportItems.ToArrayAsync());
        Assert.Equal("trainer-substitution-replaced-trainer-ambiguous", report.ReasonCode);
        Assert.Equal(0, report.RowCount);
    }

    [Fact]
    public async Task Manual_trainer_substitution_resolution_is_idempotent_and_rejects_conflicting_remap()
    {
        var date = new DateOnly(2026, 8, 24);
        var groupId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var replacedTrainerId = Guid.NewGuid();
        var substituteTrainerId = Guid.NewGuid();
        var conflictingSubstituteTrainerId = Guid.NewGuid();
        var operatorId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        SeedLegacyGroup(dbContext, groupId, date);
        dbContext.LessonOccurrences.Add(CreateOccurrence(occurrenceId, groupId, date, new TimeOnly(9, 0)));
        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = replacedTrainerId,
            ValidFrom = date.AddDays(-7),
            CreatedByUserId = operatorId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        var sourceSubstitutionId = Guid.NewGuid();
        var conflictingSourceSubstitutionId = Guid.NewGuid();
        dbContext.GroupTrainerSubstitutions.AddRange(
            new GroupTrainerSubstitution
            {
                Id = sourceSubstitutionId,
                GroupId = groupId,
                SubstituteTrainerId = substituteTrainerId,
                StartsOn = date,
                EndsOn = date,
                CreatedByUserId = operatorId,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new GroupTrainerSubstitution
            {
                Id = conflictingSourceSubstitutionId,
                GroupId = groupId,
                SubstituteTrainerId = conflictingSubstituteTrainerId,
                StartsOn = date,
                EndsOn = date,
                CreatedByUserId = operatorId,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        var run = new AttendanceTransitionRun
        {
            Id = Guid.NewGuid(),
            CutoverDate = date,
            SourceSchemaVersion = "legacy-v-manual-substitution",
            Status = AttendanceTransitionRunStatus.Blocked,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var report = new AttendanceTransitionReportItem
        {
            Id = Guid.NewGuid(),
            RunId = run.Id,
            GroupId = groupId,
            TrainingDate = date,
            AttendanceRowIdsJson = "[]",
            RowCount = 0,
            ReasonCode = "trainer-substitution-occurrence-ambiguous",
            ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.AttendanceTransitionRuns.Add(run);
        dbContext.AttendanceTransitionReportItems.Add(report);
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var resolved = await service.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                report.Id,
                operatorId,
                occurrenceId,
                replacedTrainerId,
                substituteTrainerId,
                sourceSubstitutionId,
                "manual exact repair"),
            CancellationToken.None);
        var replay = await service.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                report.Id,
                operatorId,
                occurrenceId,
                replacedTrainerId,
                substituteTrainerId,
                sourceSubstitutionId,
                "manual exact repair"),
            CancellationToken.None);
        var conflict = await service.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                report.Id,
                operatorId,
                occurrenceId,
                replacedTrainerId,
                conflictingSubstituteTrainerId,
                conflictingSourceSubstitutionId,
                "conflicting repair"),
            CancellationToken.None);
        var activation = await service.ValidateActivationAsync(run.Id, CancellationToken.None);

        Assert.True(resolved.Succeeded);
        Assert.True(resolved.ReportItemResolved);
        Assert.True(replay.Succeeded);
        Assert.True(replay.ReportItemResolved);
        Assert.Equal(AttendanceTransitionResolutionError.AttendanceRowAlreadyMapped, conflict.Error);
        Assert.True(activation.CanActivate);
        var canonical = Assert.Single(await dbContext.LessonOccurrenceTrainerSubstitutions.ToArrayAsync());
        Assert.Equal(occurrenceId, canonical.LessonOccurrenceId);
        Assert.Equal(replacedTrainerId, canonical.ReplacedTrainerId);
        Assert.Equal(substituteTrainerId, canonical.SubstituteTrainerId);
        Assert.Equal(sourceSubstitutionId, canonical.SourceGroupTrainerSubstitutionId);
        var storedReport = await dbContext.AttendanceTransitionReportItems.SingleAsync(item => item.Id == report.Id);
        Assert.Equal(AttendanceTransitionResolutionStatus.Resolved, storedReport.ResolutionStatus);
        Assert.Equal("TrainerSubstitutionManual", storedReport.ResolutionKind);
        Assert.Equal(occurrenceId, storedReport.TargetLessonOccurrenceId);
        Assert.Equal("manual exact repair", storedReport.OperatorComment);
        Assert.Single(await dbContext.AuditLogs.Where(log => log.ActionType == "AttendanceTransitionTrainerSubstitutionResolved").ToArrayAsync());
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"attendance-transition-{Guid.NewGuid():N}")
            .Options;

        return new GymCrmDbContext(options);
    }

    private static Attendance CreateUnmappedAttendance(Guid groupId, DateOnly date)
    {
        var now = DateTimeOffset.UtcNow;
        return new Attendance
        {
            Id = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            LessonOccurrenceId = Guid.Empty,
            GroupId = groupId,
            TrainingDate = date,
            IsPresent = true,
            MarkedByUserId = Guid.NewGuid(),
            MarkedAt = now,
            UpdatedAt = now
        };
    }

    private static void SeedLegacyGroup(GymCrmDbContext dbContext, Guid groupId, DateOnly date)
    {
        dbContext.TrainingGroups.Add(new TrainingGroup
        {
            Id = groupId,
            BranchId = Guid.NewGuid(),
            HallId = Guid.NewGuid(),
            GroupTypeId = Guid.NewGuid(),
            Name = $"Legacy group {groupId:N}",
            TrainingStartTime = new TimeOnly(9, 0),
            DurationMinutes = 60,
            Weekdays = [date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek],
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static LessonOccurrence CreateOccurrence(Guid occurrenceId, Guid groupId, DateOnly date, TimeOnly startTime)
    {
        return new LessonOccurrence
        {
            Id = occurrenceId,
            GroupId = groupId,
            HallId = Guid.NewGuid(),
            LessonDate = date,
            StartTime = startTime,
            DurationMinutes = 60,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }
}
