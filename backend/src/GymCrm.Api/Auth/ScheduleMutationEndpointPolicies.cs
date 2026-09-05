using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Api.Auth;

internal static partial class ScheduleEndpoints
{
    private static async Task<OneOffLessonRequestValidation> ValidateOneOffLessonRequestAsync(
        ScheduleOneOffLessonRequest request,
        User currentUser,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (!request.GroupId.HasValue)
        {
            errors["groupId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine28F39d9699];
        }

        if (!request.HallId.HasValue)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine33482d5571];
        }

        var lessonDate = ParseDate(request.LessonDate);
        if (!lessonDate.HasValue)
        {
            errors["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine3928ddd147(LessonDateFormat)];
        }

        var startTime = ParseStartTime(request.StartTime);
        if (!startTime.HasValue)
        {
            errors["startTime"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine45B177fc71];
        }

        if (request.DurationMinutes is null or < 1 or > 180)
        {
            errors["durationMinutes"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine5076aa36d0];
        }

        if (errors.Count > 0)
        {
            return new OneOffLessonRequestValidation(errors, null, null, lessonDate, startTime, request.DurationMinutes);
        }

        if (!ScheduleTimeRangePolicy.EndsOnSameDay(startTime!.Value, request.DurationMinutes!.Value))
        {
            errors["durationMinutes"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine60D04166bb];
            return new OneOffLessonRequestValidation(errors, null, null, lessonDate, startTime, request.DurationMinutes);
        }

        var groupId = request.GroupId.GetValueOrDefault();
        var hallId = request.HallId.GetValueOrDefault();

        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .Include(candidate => candidate.Branch)
            .Include(candidate => candidate.GroupType)
            .Include(candidate => candidate.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .SingleOrDefaultAsync(candidate => candidate.Id == groupId, cancellationToken);
        if (group is null)
        {
            errors["groupId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine7630b4e0b4];
        }
        else if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return new OneOffLessonRequestValidation(errors, null, null, lessonDate, startTime, request.DurationMinutes)
            {
                Forbidden = true
            };
        }

        var hall = await dbContext.Halls
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == hallId, cancellationToken);
        if (hall is null)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine915d2885e5];
        }
        else if (group is not null && hall.BranchId != group.BranchId)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine95A6285cbd];
        }

        return new OneOffLessonRequestValidation(errors, group, hall, lessonDate, startTime, request.DurationMinutes);
    }

    private static async Task<LessonChangeRequestValidation> ValidateLessonChangeRequestAsync(
        ScheduleLessonChangePreviewRequest request,
        ResolvedLessonMutationTarget target,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var scope = request.Scope?.Trim() ?? string.Empty;
        if (scope is not ("Occurrence" or "ThisAndFuture" or "EntireSeries"))
        {
            errors["scope"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine11116e60781];
        }

        if (string.IsNullOrWhiteSpace(request.ExpectedRevision))
        {
            errors["expectedRevision"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine116F663a580];
        }

        var newLessonDate = ParseDate(request.NewLessonDate);
        if (!newLessonDate.HasValue)
        {
            errors["newLessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine12228ddd147(LessonDateFormat)];
        }

        var startTime = ParseStartTime(request.StartTime);
        if (!startTime.HasValue)
        {
            errors["startTime"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine128B177fc71];
        }

        if (request.DurationMinutes is null or < 1 or > 180)
        {
            errors["durationMinutes"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine13376aa36d0];
        }

        if (!request.HallId.HasValue)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine138482d5571];
        }

        if (errors.Count > 0)
        {
            return new LessonChangeRequestValidation(errors, scope, null, newLessonDate, startTime, request.DurationMinutes);
        }

        if (!ScheduleTimeRangePolicy.EndsOnSameDay(startTime!.Value, request.DurationMinutes!.Value))
        {
            errors["durationMinutes"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine148D04166bb];
        }

        var hallId = request.HallId.GetValueOrDefault();
        var hall = await dbContext.Halls
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == hallId, cancellationToken);
        if (hall is null)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine1575d2885e5];
        }
        else if (hall.BranchId != target.Group.BranchId)
        {
            errors["hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine161A6285cbd];
        }

        if (scope is "ThisAndFuture" or "EntireSeries" &&
            (target.Series is null || target.RuleVersion is null || target.Slot is null || target.Occurrence is not null))
        {
            errors["scope"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine167E9858bca];
        }

        return new LessonChangeRequestValidation(errors, scope, hall, newLessonDate, startTime, request.DurationMinutes);
    }

    private static async Task<IResult?> ValidateLessonChangeHardOverlapAsync(
        ResolvedLessonMutationTarget target,
        LessonChangeRequestValidation parsed,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var newLessonDate = parsed.NewLessonDate.GetValueOrDefault();
        var startTime = parsed.StartTime.GetValueOrDefault();
        var durationMinutes = parsed.DurationMinutes.GetValueOrDefault();
        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.Id != target.OccurrenceId &&
                occurrence.GroupId == target.Group.Id &&
                occurrence.LessonDate == newLessonDate &&
                occurrence.Status == LessonOccurrenceStatus.Scheduled)
            .Select(occurrence => new { occurrence.StartTime, occurrence.DurationMinutes })
            .ToArrayAsync(cancellationToken);
        if (materialized.Any(occurrence => ScheduleTimeRangePolicy.Overlaps(
                parsed.StartTime!.Value,
                durationMinutes,
                occurrence.StartTime,
                occurrence.DurationMinutes)))
        {
            return CreateOneOffOverlapProblem();
        }

        var weekday = ToIsoWeekday(newLessonDate);
        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(candidate =>
                candidate.GroupId == target.Group.Id &&
                candidate.StartsOn <= newLessonDate &&
                (candidate.EndsOn == null || candidate.EndsOn >= newLessonDate))
            .Include(candidate => candidate.RuleVersions)
                .ThenInclude(version => version.Slots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        foreach (var slot in series.SelectMany(candidate => candidate.RuleVersions
                     .Where(version =>
                         version.EffectiveFrom <= newLessonDate &&
                         (version.EffectiveTo == null || version.EffectiveTo >= newLessonDate))
                     .SelectMany(version => version.Slots.Where(slot => slot.IsoWeekday == weekday))))
        {
            var projectedId = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, newLessonDate);
            if (projectedId == target.OccurrenceId)
            {
                continue;
            }

            if (ScheduleTimeRangePolicy.Overlaps(
                    startTime,
                    durationMinutes,
                    slot.StartTime,
                    slot.DurationMinutes))
            {
                return CreateOneOffOverlapProblem();
            }
        }

        return null;
    }

    private static async Task<IReadOnlyList<ScheduleWarningResponse>> BuildLessonChangeWarningsAsync(
        ResolvedLessonMutationTarget target,
        LessonChangeRequestValidation parsed,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var newLessonDate = parsed.NewLessonDate.GetValueOrDefault();
        var startTime = parsed.StartTime.GetValueOrDefault();
        var durationMinutes = parsed.DurationMinutes.GetValueOrDefault();
        var hall = parsed.Hall ?? throw new InvalidOperationException("Validated lesson change hall was not available.");
        var warnings = new Dictionary<string, ScheduleWarningResponse>(StringComparer.Ordinal);
        var targetTrainerIds = target.Group.TrainerAssignments
            .Where(assignment =>
                assignment.ValidFrom <= newLessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= newLessonDate))
            .Select(assignment => assignment.TrainerId)
            .ToHashSet();

        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.TrainerAssignments)
            .Where(occurrence =>
                occurrence.Id != target.OccurrenceId &&
                occurrence.LessonDate == newLessonDate &&
                occurrence.Status == LessonOccurrenceStatus.Scheduled)
            .ToArrayAsync(cancellationToken);
        foreach (var occurrence in materialized.Where(occurrence => ScheduleTimeRangePolicy.Overlaps(
                     startTime,
                     durationMinutes,
                     occurrence.StartTime,
                     occurrence.DurationMinutes)))
        {
            AddWarningsForCandidate(warnings, targetTrainerIds, hall.Id, occurrence.HallId, occurrence.Group, newLessonDate);
        }

        var weekday = ToIsoWeekday(newLessonDate);
        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(candidate =>
                candidate.StartsOn <= newLessonDate &&
                (candidate.EndsOn == null || candidate.EndsOn >= newLessonDate))
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.TrainerAssignments)
            .Include(candidate => candidate.RuleVersions)
                .ThenInclude(version => version.Slots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        foreach (var candidate in series)
        {
            foreach (var slot in candidate.RuleVersions
                         .Where(version =>
                             version.EffectiveFrom <= newLessonDate &&
                             (version.EffectiveTo == null || version.EffectiveTo >= newLessonDate))
                         .SelectMany(version => version.Slots.Where(slot => slot.IsoWeekday == weekday)))
            {
                var projectedId = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, newLessonDate);
                if (projectedId == target.OccurrenceId ||
                    !ScheduleTimeRangePolicy.Overlaps(startTime, durationMinutes, slot.StartTime, slot.DurationMinutes))
                {
                    continue;
                }

                AddWarningsForCandidate(warnings, targetTrainerIds, hall.Id, slot.HallId, candidate.Group, newLessonDate);
            }
        }

        return warnings.Values.OrderBy(warning => warning.Code, StringComparer.Ordinal).ToArray();
    }

    private static void AddWarningsForCandidate(
        IDictionary<string, ScheduleWarningResponse> warnings,
        IReadOnlySet<Guid> targetTrainerIds,
        Guid targetHallId,
        Guid candidateHallId,
        TrainingGroup candidateGroup,
        DateOnly lessonDate)
    {
        if (candidateHallId == targetHallId)
        {
            warnings.TryAdd(
                "lesson_hall_overlap",
                new ScheduleWarningResponse("lesson_hall_overlap", global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine3184ea9330e));
        }

        if (candidateGroup.TrainerAssignments.Any(assignment =>
                targetTrainerIds.Contains(assignment.TrainerId) &&
                assignment.ValidFrom <= lessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= lessonDate)))
        {
            warnings.TryAdd(
                "lesson_trainer_overlap",
                new ScheduleWarningResponse("lesson_trainer_overlap", global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine3280782c36f));
        }
    }

    private static async Task<IResult?> ValidateOneOffOverlapAsync(
        Guid groupId,
        DateOnly lessonDate,
        TimeOnly startTime,
        int durationMinutes,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.GroupId == groupId &&
                occurrence.LessonDate == lessonDate &&
                occurrence.Status == LessonOccurrenceStatus.Scheduled)
            .Select(occurrence => new { occurrence.StartTime, occurrence.DurationMinutes })
            .ToArrayAsync(cancellationToken);
        if (materialized.Any(occurrence => ScheduleTimeRangePolicy.Overlaps(
                startTime,
                durationMinutes,
                occurrence.StartTime,
                occurrence.DurationMinutes)))
        {
            return CreateOneOffOverlapProblem();
        }

        var weekday = ToIsoWeekday(lessonDate);
        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(candidate =>
                candidate.GroupId == groupId &&
                candidate.StartsOn <= lessonDate &&
                (candidate.EndsOn == null || candidate.EndsOn >= lessonDate))
            .Include(candidate => candidate.RuleVersions)
                .ThenInclude(version => version.Slots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        var projectedSlots = series
            .SelectMany(candidate => candidate.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= lessonDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= lessonDate))
                .SelectMany(version => version.Slots.Where(slot => slot.IsoWeekday == weekday)));
        if (projectedSlots.Any(slot => ScheduleTimeRangePolicy.Overlaps(
                startTime,
                durationMinutes,
                slot.StartTime,
                slot.DurationMinutes)))
        {
            return CreateOneOffOverlapProblem();
        }

        return null;
    }

    private static async Task<ResolvedLessonMutationTarget?> ResolveLessonForMutationAsync(
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        User currentUser,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var occurrence = await dbContext.LessonOccurrences
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.Branch)
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.GroupType)
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.TrainerAssignments)
                    .ThenInclude(assignment => assignment.Trainer)
            .Include(candidate => candidate.Hall)
            .Include(candidate => candidate.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.ReplacedTrainer)
            .Include(candidate => candidate.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.SubstituteTrainer)
            .SingleOrDefaultAsync(candidate => candidate.Id == lessonOccurrenceId, cancellationToken);
        if (occurrence is not null)
        {
            if (occurrence.LessonDate != lessonDate ||
                !GroupManagementScope.Contains(currentUser, occurrence.Group.BranchId))
            {
                return null;
            }

            return new ResolvedLessonMutationTarget(
                occurrence,
                occurrence.Id,
                null,
                null,
                null,
                occurrence.Group,
                occurrence.Hall,
                occurrence.LessonDate,
                occurrence.StartTime,
                occurrence.DurationMinutes,
                occurrence.Status,
                occurrence.SourceKind);
        }

        var weekday = ToIsoWeekday(lessonDate);
        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(candidate =>
                candidate.StartsOn <= lessonDate &&
                (candidate.EndsOn == null || candidate.EndsOn >= lessonDate))
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.Branch)
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.GroupType)
            .Include(candidate => candidate.Group)
                .ThenInclude(group => group.TrainerAssignments)
                    .ThenInclude(assignment => assignment.Trainer)
            .Include(candidate => candidate.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
        foreach (var candidate in series.Where(candidate => GroupManagementScope.Contains(currentUser, candidate.Group.BranchId)))
        {
            foreach (var version in candidate.RuleVersions.Where(version =>
                         version.EffectiveFrom <= lessonDate &&
                         (version.EffectiveTo == null || version.EffectiveTo >= lessonDate)))
            {
                foreach (var slot in version.Slots.Where(slot => slot.IsoWeekday == weekday))
                {
                    if (LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, lessonDate) != lessonOccurrenceId)
                    {
                        continue;
                    }

                    return new ResolvedLessonMutationTarget(
                        null,
                        lessonOccurrenceId,
                        candidate,
                        version,
                        slot,
                        candidate.Group,
                        slot.Hall,
                        lessonDate,
                        slot.StartTime,
                        slot.DurationMinutes,
                        LessonOccurrenceStatus.Scheduled,
                        LessonOccurrenceSourceKind.Recurring);
                }
            }
        }

        return null;
    }

    private static ScheduleLessonResponse MapResolvedMutationTarget(
        ResolvedLessonMutationTarget target,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        bool hasAttendanceMarks)
    {
        return MapLesson(
            target.OccurrenceId,
            target.SourceKind.ToString(),
            target.Occurrence is not null,
            target.Series?.Id ?? target.Occurrence?.SourceLessonSeriesId,
            target.LessonDate,
            target.StartTime,
            target.DurationMinutes,
            target.Group,
            target.Hall,
            target.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            hasAttendanceMarks
                ? new HashSet<Guid> { target.OccurrenceId }
                : new HashSet<Guid>(),
            target.Occurrence is null
                ? $"{target.Series!.Id:D}:{target.RuleVersion!.Id:D}:{target.Slot!.Id:D}:{target.Slot.SlotLineageId:D}"
                : $"{target.Occurrence.Id:D}:{target.Occurrence.Version}",
            target.Occurrence?.TrainerSubstitutions);
    }

    private static async Task<bool> HasAttendanceMarksAsync(
        Guid lessonOccurrenceId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Attendance
            .AsNoTracking()
            .AnyAsync(attendance => attendance.LessonOccurrenceId == lessonOccurrenceId, cancellationToken);
    }

    private static TimeOnly? ParseStartTime(string? value)
    {
        return TimeOnly.TryParseExact(
            value?.Trim(),
            "HH\\:mm",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static ScheduleOneOffConfirmationPayload CreateOneOffPayload(
        Guid occurrenceId,
        Guid groupId,
        DateOnly lessonDate,
        TimeOnly startTime,
        int durationMinutes,
        Guid hallId)
    {
        return new ScheduleOneOffConfirmationPayload(
            occurrenceId,
            groupId,
            lessonDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            startTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            durationMinutes,
            hallId);
    }

    private static async Task<ScheduleLessonChangeImpactResponse> BuildLessonChangeImpactAsync(
        ResolvedLessonMutationTarget target,
        LessonChangeRequestValidation parsed,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var boundary = GetLessonChangeBoundary(target, parsed, currentUser, attendanceDatePolicy);
        if (parsed.Scope == "Occurrence")
        {
            return new ScheduleLessonChangeImpactResponse(parsed.Scope, boundary, false, []);
        }

        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.GroupId == target.Group.Id &&
                occurrence.SourceLessonSeriesId == target.Series!.Id &&
                occurrence.SourceSlotLineageId == target.Slot!.SlotLineageId &&
                ((occurrence.ProjectedDate ?? occurrence.LessonDate) >= boundary ||
                    occurrence.LessonDate >= boundary))
            .Select(occurrence => new
            {
                occurrence.Id,
                occurrence.LessonDate,
                occurrence.Status
            })
            .ToArrayAsync(cancellationToken);
        var materializedIds = materialized.Select(occurrence => occurrence.Id).ToArray();
        var attendanceOccurrenceIds = materializedIds.Length == 0
            ? new HashSet<Guid>()
            : (await dbContext.Attendance
                .AsNoTracking()
                .Where(attendance => materializedIds.Contains(attendance.LessonOccurrenceId))
                .Select(attendance => attendance.LessonOccurrenceId)
                .Distinct()
                .ToArrayAsync(cancellationToken)).ToHashSet();

        var skipped = materialized
            .OrderBy(occurrence => occurrence.LessonDate)
            .ThenBy(occurrence => occurrence.Id)
            .Select(occurrence => new ScheduleLessonChangeSkippedOccurrenceResponse(
                occurrence.Id,
                occurrence.LessonDate,
                attendanceOccurrenceIds.Contains(occurrence.Id)
                    ? "attendance-fact"
                    : occurrence.Status == LessonOccurrenceStatus.Cancelled
                        ? "cancelled"
                        : "materialized-exception"))
            .ToArray();

        return new ScheduleLessonChangeImpactResponse(parsed.Scope, boundary, true, skipped);
    }

    private static DateOnly GetLessonChangeBoundary(
        ResolvedLessonMutationTarget target,
        LessonChangeRequestValidation parsed,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy)
    {
        return parsed.Scope switch
        {
            "EntireSeries" => MaxDate(target.Series!.StartsOn, attendanceDatePolicy.GetWindow(currentUser.Role).Today),
            "ThisAndFuture" => target.LessonDate,
            _ => target.LessonDate
        };
    }

    private static async Task<IResult> ApplySeriesLessonChangeAsync(
        ResolvedLessonMutationTarget target,
        LessonChangeRequestValidation parsed,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
        ScheduleMutationConfirmationToken token,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var boundary = GetLessonChangeBoundary(target, parsed, currentUser, attendanceDatePolicy);
        var sourceRuleVersionId = target.RuleVersion?.Id
            ?? throw new InvalidOperationException("Series change target rule version was not resolved.");
        var sourceSlotId = target.Slot?.Id
            ?? throw new InvalidOperationException("Series change target slot was not resolved.");

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
            dbContext,
            token,
            now,
            cancellationToken);
        if (tokenClaim == ScheduleMutationTokenClaimResult.Invalid)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        if (tokenClaim == ScheduleMutationTokenClaimResult.Expired)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var currentRule = await dbContext.LessonScheduleRuleVersions
            .Include(version => version.LessonSeries)
            .Include(version => version.Slots)
            .SingleAsync(version => version.Id == sourceRuleVersionId, cancellationToken);
        if (boundary <= currentRule.EffectiveFrom)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        currentRule.EffectiveTo = boundary.AddDays(-1);
        currentRule.LessonSeries.UpdatedAt = now;
        var replacementRule = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = currentRule.LessonSeriesId,
            VersionNumber = await dbContext.LessonScheduleRuleVersions
                .Where(version => version.LessonSeriesId == currentRule.LessonSeriesId)
                .MaxAsync(version => version.VersionNumber, cancellationToken) + 1,
            EffectiveFrom = boundary,
            EffectiveTo = target.RuleVersion!.EffectiveTo,
            CreatedAt = now
        };
        dbContext.LessonScheduleRuleVersions.Add(replacementRule);

        var changedSlotLineageId = target.Slot!.SlotLineageId;
        var changedSlotWeekday = ToIsoWeekday(parsed.NewLessonDate!.Value);
        if (changedSlotWeekday != target.Slot.IsoWeekday)
        {
            changedSlotLineageId = Guid.NewGuid();
        }

        LessonScheduleSlot? changedSlot = null;
        foreach (var slot in currentRule.Slots.OrderBy(slot => slot.IsoWeekday).ThenBy(slot => slot.StartTime).ThenBy(slot => slot.Id))
        {
            var isChangedSlot = slot.Id == sourceSlotId;
            var replacementSlot = new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                LessonScheduleRuleVersionId = replacementRule.Id,
                SlotLineageId = isChangedSlot ? changedSlotLineageId : slot.SlotLineageId,
                IsoWeekday = isChangedSlot ? changedSlotWeekday : slot.IsoWeekday,
                StartTime = isChangedSlot ? parsed.StartTime!.Value : slot.StartTime,
                DurationMinutes = isChangedSlot ? parsed.DurationMinutes!.Value : slot.DurationMinutes,
                HallId = isChangedSlot ? parsed.Hall!.Id : slot.HallId,
                CreatedAt = now
            };
            dbContext.LessonScheduleSlots.Add(replacementSlot);
            if (isChangedSlot)
            {
                changedSlot = replacementSlot;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "LessonScheduleSeriesChanged",
                "LessonSeries",
                currentRule.LessonSeriesId.ToString(),
                global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine7102b1d8fc0(currentUser.Login),
                OldValueJson: JsonSerializer.Serialize(new
                {
                    RuleVersionId = currentRule.Id,
                    currentRule.EffectiveFrom,
                    EffectiveTo = boundary.AddDays(-1)
                }, JsonOptions),
                NewValueJson: JsonSerializer.Serialize(new
                {
                    RuleVersionId = replacementRule.Id,
                    replacementRule.EffectiveFrom,
                    replacementRule.EffectiveTo,
                    Scope = parsed.Scope,
                    SlotLineageId = changedSlot!.SlotLineageId
                }, JsonOptions)),
            cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var changedOccurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(changedSlot!.SlotLineageId, parsed.NewLessonDate.Value);
        return TypedResults.Ok(MapLesson(
            changedOccurrenceId,
            LessonOccurrenceSourceKind.Recurring.ToString(),
            false,
            currentRule.LessonSeriesId,
            parsed.NewLessonDate.Value,
            changedSlot.StartTime,
            changedSlot.DurationMinutes,
            target.Group,
            parsed.Hall!,
            LessonOccurrenceStatus.Scheduled.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"{currentRule.LessonSeriesId:D}:{replacementRule.Id:D}:{changedSlot.Id:D}:{changedSlot.SlotLineageId:D}"));
    }

    private static DateOnly MaxDate(DateOnly left, DateOnly right)
    {
        return left >= right ? left : right;
    }

    private static ScheduleOccurrenceChangeConfirmationPayload CreateChangePayload(
        Guid occurrenceId,
        DateOnly locatorDate,
        string expectedRevision,
        LessonChangeRequestValidation parsed,
        IReadOnlyList<ScheduleWarningResponse> warnings)
    {
        return new ScheduleOccurrenceChangeConfirmationPayload(
            occurrenceId,
            locatorDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            parsed.Scope,
            parsed.NewLessonDate!.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            parsed.StartTime!.Value.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            parsed.DurationMinutes!.Value,
            parsed.Hall!.Id,
            expectedRevision.Trim(),
            warnings.Select(warning => warning.Code).Order(StringComparer.Ordinal).ToArray());
    }

    private static ProblemHttpResult CreateConfirmationTokenProblem(string code, int statusCode)
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = $"/problems/{code}",
            Title = global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine7787a30e3b9,
            Status = statusCode,
            Extensions =
            {
                ["code"] = code
            }
        });
    }

    private static ValidationProblem CreateOneOffOverlapProblem()
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["startTime"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine791E0c07c34]
        });
    }

    private static ProblemHttpResult CreateLessonMutationProblem(string code, int statusCode)
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = $"/problems/{code}",
            Title = global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine800F937dd9e,
            Status = statusCode,
            Extensions =
            {
                ["code"] = code
            }
        });
    }

    private static string? NormalizeCancellationAction(string? action)
    {
        return action?.Trim() switch
        {
            "Cancel" => "Cancel",
            "Restore" => "Restore",
            _ => null
        };
    }

    private static async Task<IResult?> ValidateCancellationStateAsync(
        ResolvedLessonMutationTarget target,
        string action,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (action == "Restore")
        {
            return target is { Status: LessonOccurrenceStatus.Cancelled, Occurrence: not null }
                ? null
                : CreateLessonMutationProblem("lesson-not-cancelled", StatusCodes.Status409Conflict);
        }

        if (target.Status == LessonOccurrenceStatus.Cancelled)
        {
            return CreateLessonMutationProblem("lesson-not-scheduled", StatusCodes.Status409Conflict);
        }

        var attendanceMarksCount = await CountAttendanceMarksAsync(target, dbContext, cancellationToken);
        return attendanceMarksCount == 0
            ? null
            : CreateAttendanceStateConflictProblem(target.OccurrenceId, attendanceMarksCount);
    }

    private static async Task<int> CountAttendanceMarksAsync(
        ResolvedLessonMutationTarget target,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Attendance
            .AsNoTracking()
            .CountAsync(attendance => attendance.LessonOccurrenceId == target.OccurrenceId, cancellationToken);
    }

    private static ProblemHttpResult CreateAttendanceStateConflictProblem(Guid lessonOccurrenceId, int attendanceMarksCount)
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/lesson-attendance-state-conflict",
            Title = global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine85893a9c18e,
            Status = StatusCodes.Status409Conflict,
            Extensions =
            {
                ["code"] = "lesson-attendance-state-conflict",
                ["lessonOccurrenceId"] = lessonOccurrenceId,
                ["attendanceMarksCount"] = attendanceMarksCount,
                ["recoveryCode"] = "edit-attendance-before-cancellation"
            }
        });
    }

    private static ScheduleOccurrenceCancellationConfirmationPayload CreateCancellationPayload(
        Guid occurrenceId,
        DateOnly locatorDate,
        string action,
        string expectedRevision,
        LessonOccurrenceStatus status)
    {
        return new ScheduleOccurrenceCancellationConfirmationPayload(
            occurrenceId,
            locatorDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            action,
            expectedRevision.Trim(),
            status.ToString());
    }

    private static async Task<IResult> ApplyCancellationMutationAsync(
        ResolvedLessonMutationTarget target,
        string action,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
        ScheduleMutationConfirmationToken token,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
            dbContext,
            token,
            now,
            cancellationToken);
        if (tokenClaim == ScheduleMutationTokenClaimResult.Invalid)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        if (tokenClaim == ScheduleMutationTokenClaimResult.Expired)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        LessonOccurrence occurrence;
        if (action == "Cancel")
        {
            if (target.Occurrence is null)
            {
                occurrence = new LessonOccurrence
                {
                    Id = target.OccurrenceId,
                    GroupId = target.Group.Id,
                    LessonDate = target.LessonDate,
                    StartTime = target.StartTime,
                    DurationMinutes = target.DurationMinutes,
                    HallId = target.Hall.Id,
                    SourceLessonSeriesId = target.Series?.Id,
                    SourceRuleVersionId = target.RuleVersion?.Id,
                    SourceSlotId = target.Slot?.Id,
                    SourceSlotLineageId = target.Slot?.SlotLineageId,
                    ProjectedDate = target.LessonDate,
                    Status = LessonOccurrenceStatus.Cancelled,
                    SourceKind = target.SourceKind,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                dbContext.LessonOccurrences.Add(occurrence);
            }
            else
            {
                occurrence = target.Occurrence;
                occurrence.Status = LessonOccurrenceStatus.Cancelled;
                occurrence.UpdatedAt = now;
            }
        }
        else
        {
            occurrence = target.Occurrence
                ?? throw new InvalidOperationException("Restore target occurrence was not materialized.");
            occurrence.Status = LessonOccurrenceStatus.Scheduled;
            occurrence.UpdatedAt = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                action == "Cancel" ? "LessonOccurrenceCancelled" : "LessonOccurrenceRestored",
                "LessonOccurrence",
                occurrence.Id.ToString(),
                action == "Cancel"
                    ? global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine9608c1eb014(currentUser.Login)
                    : global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleMutationEndpointPoliciesLine961Ebb54a99(currentUser.Login),
                OldValueJson: JsonSerializer.Serialize(new
                {
                    Status = action == "Cancel"
                        ? LessonOccurrenceStatus.Scheduled.ToString()
                        : LessonOccurrenceStatus.Cancelled.ToString()
                }, JsonOptions),
                NewValueJson: JsonSerializer.Serialize(CreateLessonOccurrenceAuditState(occurrence), JsonOptions)),
            cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return TypedResults.Ok(MapLesson(
            occurrence.Id,
            occurrence.SourceKind.ToString(),
            true,
            occurrence.SourceLessonSeriesId,
            occurrence.LessonDate,
            occurrence.StartTime,
            occurrence.DurationMinutes,
            target.Group,
            target.Hall,
            occurrence.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"{occurrence.Id:D}:{occurrence.Version}"));
    }

    private static async Task<IDbContextTransaction?> BeginTransactionIfSupportedAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        return providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase)
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private static object CreateLessonOccurrenceAuditState(LessonOccurrence occurrence)
    {
        return new
        {
            occurrence.Id,
            occurrence.GroupId,
            occurrence.LessonDate,
            occurrence.StartTime,
            occurrence.DurationMinutes,
            occurrence.HallId,
            Status = occurrence.Status.ToString(),
            SourceKind = occurrence.SourceKind.ToString()
        };
    }

}
