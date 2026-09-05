using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Api.Auth;

internal static class GroupLessonSeriesEndpoints
{
    private const int MaxImpactProjectionDays = 31;
    private const int MaxImpactExamples = 20;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static RouteGroupBuilder Map(RouteGroupBuilder group)
    {
        group.MapGet(GroupApiConstants.LessonSeriesRoute, GetAsync);
        group.MapPost(GroupApiConstants.LessonSeriesPreviewRoute, PreviewAsync);
        group.MapPost(GroupApiConstants.LessonSeriesRoute, ExecuteAsync);
        return group;
    }

    private static async Task<IResult> GetAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var series = await LoadSeriesAsync(id, dbContext, cancellationToken);
        if (series is null)
        {
            return CreateLessonSeriesProblem("lesson-series-not-found", StatusCodes.Status404NotFound);
        }

        if (!GroupManagementScope.Contains(currentUser, series.Group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        return TypedResults.Ok(MapReadResponse(series, businessDateProvider.Today));
    }

    private static async Task<IResult> PreviewAsync(
        Guid id,
        GroupLessonSeriesPreviewRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var series = await LoadSeriesAsync(id, dbContext, cancellationToken);
        if (series is null)
        {
            return CreateLessonSeriesProblem("lesson-series-not-found", StatusCodes.Status404NotFound);
        }

        if (!GroupManagementScope.Contains(currentUser, series.Group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateAsync(
            series,
            request.Scope,
            request.EffectiveFrom,
            request.EndsOn,
            request.Slots,
            businessDateProvider.Today,
            dbContext,
            cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var revision = BuildRevision(series);
        if (!string.IsNullOrWhiteSpace(request.ExpectedRevision) &&
            !string.Equals(request.ExpectedRevision.Trim(), revision, StringComparison.Ordinal))
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var warnings = await BuildWarningsAsync(series.GroupId, parsed.EffectiveFrom, parsed.EndsOn, parsed.Slots, dbContext, cancellationToken);
        var impact = await BuildImpactAsync(series, parsed.EffectiveFrom, parsed.EndsOn, parsed.Slots, dbContext, cancellationToken);
        var payload = CreatePayload(series, parsed, revision, warnings);
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var rawToken = ScheduleMutationTokenPolicy.CreateSecureToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(ScheduleMutationTokenPolicy.ConfirmationTokenLifetime);

        dbContext.ScheduleMutationConfirmationTokens.Add(new ScheduleMutationConfirmationToken
        {
            Id = Guid.NewGuid(),
            TokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken),
            ActorUserId = currentUser.Id,
            Purpose = ScheduleMutationTokenPolicy.GroupLessonSeriesPurpose,
            PayloadHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson),
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new GroupLessonSeriesPreviewResponse(
            rawToken,
            expiresAt,
            revision,
            parsed.Scope,
            parsed.EffectiveFrom,
            parsed.EndsOn,
            MapSlots(parsed.Slots),
            impact,
            warnings));
    }

    private static async Task<IResult> ExecuteAsync(
        Guid id,
        GroupLessonSeriesExecuteRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IBusinessDateProvider businessDateProvider,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmationToken))
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(request.ConfirmationToken.Trim());
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.GroupLessonSeriesPurpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var series = await LoadSeriesForMutationAsync(id, dbContext, cancellationToken);
        if (series is null)
        {
            return CreateLessonSeriesProblem("lesson-series-not-found", StatusCodes.Status404NotFound);
        }

        if (!GroupManagementScope.Contains(currentUser, series.Group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateAsync(
            series,
            request.Scope,
            request.EffectiveFrom,
            request.EndsOn,
            request.Slots,
            businessDateProvider.Today,
            dbContext,
            cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var revision = BuildRevision(series);
        if (!string.IsNullOrWhiteSpace(request.ExpectedRevision) &&
            !string.Equals(request.ExpectedRevision.Trim(), revision, StringComparison.Ordinal))
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var warnings = await BuildWarningsAsync(series.GroupId, parsed.EffectiveFrom, parsed.EndsOn, parsed.Slots, dbContext, cancellationToken);
        var payload = CreatePayload(series, parsed, revision, warnings);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, payload))
        {
            return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var impact = await BuildImpactAsync(series, parsed.EffectiveFrom, parsed.EndsOn, parsed.Slots, dbContext, cancellationToken);
        var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        try
        {
            var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
                dbContext,
                token,
                now,
                cancellationToken);
            if (tokenClaim == ScheduleMutationTokenClaimResult.Invalid)
            {
                return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
            }

            if (tokenClaim == ScheduleMutationTokenClaimResult.Expired)
            {
                return CreateLessonSeriesProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
            }

            var oldState = JsonSerializer.Serialize(CreateAuditState(series), JsonOptions);
            ApplyReplacementVersion(series, parsed, now, dbContext);
            await dbContext.SaveChangesAsync(cancellationToken);

            var updatedSeries = await LoadSeriesAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated lesson series for group '{id}' was not found.");
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    "LessonSeriesUpdated",
                    "LessonSeries",
                    series.Id.ToString(),
                    global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine25959efe004(currentUser.Login, series.Group.Name),
                    oldState,
                    JsonSerializer.Serialize(CreateAuditState(updatedSeries), JsonOptions)),
                cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }

        var finalSeries = await LoadSeriesAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated lesson series for group '{id}' was not found.");
        return TypedResults.Ok(new GroupLessonSeriesExecuteResponse(
            BuildRevision(finalSeries),
            parsed.Scope,
            parsed.EffectiveFrom,
            parsed.EndsOn,
            MapSlots(parsed.Slots),
            impact,
            warnings));
    }

    private static async Task<LessonSeries?> LoadSeriesAsync(Guid groupOrSeriesId, GymCrmDbContext dbContext, CancellationToken cancellationToken)
    {
        return await dbContext.LessonSeries
            .AsNoTracking()
            .Include(series => series.Group)
                .ThenInclude(group => group.Branch)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(
                series => series.GroupId == groupOrSeriesId || series.Id == groupOrSeriesId,
                cancellationToken);
    }

    private static async Task<LessonSeries?> LoadSeriesForMutationAsync(Guid groupOrSeriesId, GymCrmDbContext dbContext, CancellationToken cancellationToken)
    {
        return await dbContext.LessonSeries
            .Include(series => series.Group)
                .ThenInclude(group => group.Branch)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(
                series => series.GroupId == groupOrSeriesId || series.Id == groupOrSeriesId,
                cancellationToken);
    }

    private static async Task<LessonSeriesValidation> ValidateAsync(
        LessonSeries series,
        string? rawScope,
        string? rawEffectiveFrom,
        string? rawEndsOn,
        IReadOnlyList<GroupLessonSeriesSlotRequest>? rawSlots,
        DateOnly businessToday,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var scope = rawScope?.Trim();
        if (scope is not ("ThisAndFuture" or "EntireSeries"))
        {
            errors["scope"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine332D9e0e4b9];
        }

        DateOnly effectiveFrom = series.StartsOn;
        if (scope == "ThisAndFuture")
        {
            if (!TryParseDate(rawEffectiveFrom, out effectiveFrom))
            {
                errors["effectiveFrom"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine340D48cb928];
            }
        }

        if (scope == "EntireSeries")
        {
            effectiveFrom = MaxDate(series.StartsOn, businessToday);
        }

        DateOnly? endsOn = null;
        if (!string.IsNullOrWhiteSpace(rawEndsOn))
        {
            if (!TryParseDate(rawEndsOn, out var parsedEndsOn))
            {
                errors["endsOn"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine354Ebe48b29];
            }
            else
            {
                endsOn = parsedEndsOn;
            }
        }

        if (endsOn.HasValue && errors.Count == 0 && endsOn.Value < effectiveFrom)
        {
            errors["endsOn"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine364C751802f];
        }

        if (rawSlots is null || rawSlots.Count == 0)
        {
            errors["slots"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine3696a78640e];
        }

        var slots = new List<LessonSeriesSlotCandidate>();
        if (rawSlots is not null)
        {
            for (var index = 0; index < rawSlots.Count; index++)
            {
                var slot = rawSlots[index];
                var prefix = $"slots[{index}]";
                if (slot.IsoWeekday is < 1 or > 7 or null)
                {
                    errors[$"{prefix}.isoWeekday"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine38103b7e917];
                }

                var startTime = GroupRequestValidator.ParseTrainingStartTime(slot.StartTime);
                if (startTime is null)
                {
                    errors[$"{prefix}.startTime"] = [GroupResources.TrainingStartTimeInvalid(GroupApiConstants.TrainingStartTimeDisplayFormat)];
                }

                if (slot.DurationMinutes is < GroupApiConstants.MinDurationMinutes or > GroupApiConstants.MaxDurationMinutes or null)
                {
                    errors[$"{prefix}.durationMinutes"] =
                        [GroupResources.DurationMinutesOutOfRange(GroupApiConstants.MinDurationMinutes, GroupApiConstants.MaxDurationMinutes)];
                }

                if (!slot.HallId.HasValue || slot.HallId.Value == Guid.Empty)
                {
                    errors[$"{prefix}.hallId"] = [GroupResources.InvalidHallId];
                }

                if (slot.IsoWeekday.HasValue && startTime.HasValue && slot.DurationMinutes.HasValue && slot.HallId.HasValue)
                {
                    slots.Add(new LessonSeriesSlotCandidate(
                        slot.IsoWeekday.Value,
                        startTime.Value,
                        slot.DurationMinutes.Value,
                        slot.HallId.Value,
                        string.Empty));
                }
            }
        }

        if (errors.Count == 0)
        {
            var hallIds = slots.Select(slot => slot.HallId).Distinct().ToArray();
            var halls = await dbContext.Halls
                .AsNoTracking()
                .Where(hall => hallIds.Contains(hall.Id))
                .Select(hall => new { hall.Id, hall.Name, hall.BranchId })
                .ToArrayAsync(cancellationToken);

            foreach (var missingHallId in hallIds.Except(halls.Select(hall => hall.Id)))
            {
                errors[$"slots.hallId.{missingHallId:D}"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine4245d2885e5];
            }

            if (halls.Any(hall => hall.BranchId != series.Group.BranchId))
            {
                errors["slots.hallId"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine4298874f5c8];
            }

            foreach (var overlap in slots
                         .GroupBy(slot => slot.IsoWeekday)
                         .SelectMany(group => group.SelectMany((left, leftIndex) => group.Skip(leftIndex + 1).Select(right => (left, right))))
                         .Where(pair => ScheduleTimeRangePolicy.Overlaps(pair.left.StartTime, pair.left.DurationMinutes, pair.right.StartTime, pair.right.DurationMinutes)))
            {
                errors["slots"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine437371250ec(overlap.left.IsoWeekday)];
                break;
            }

            slots = slots
                .Select(slot => slot with { HallName = halls.Single(hall => hall.Id == slot.HallId).Name })
                .OrderBy(slot => slot.IsoWeekday)
                .ThenBy(slot => slot.StartTime)
                .ThenBy(slot => slot.HallId)
                .ToList();
        }

        return new LessonSeriesValidation(errors, scope ?? string.Empty, effectiveFrom, endsOn, slots);
    }

    private static async Task<IReadOnlyList<ScheduleWarningResponse>> BuildWarningsAsync(
        Guid groupId,
        DateOnly effectiveFrom,
        DateOnly? endsOn,
        IReadOnlyList<LessonSeriesSlotCandidate> slots,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var to = MinDate(endsOn ?? effectiveFrom.AddDays(MaxImpactProjectionDays - 1), effectiveFrom.AddDays(MaxImpactProjectionDays - 1));
        var hallIds = slots.Select(slot => slot.HallId).Distinct().ToArray();
        var otherSeries = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(series =>
                series.GroupId != groupId &&
                series.StartsOn <= to &&
                (series.EndsOn == null || series.EndsOn >= effectiveFrom))
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
            .ToArrayAsync(cancellationToken);

        return otherSeries
            .SelectMany(series => series.RuleVersions)
            .Where(version => version.EffectiveFrom <= to && (version.EffectiveTo == null || version.EffectiveTo >= effectiveFrom))
            .SelectMany(version => version.Slots)
            .Any(existing => hallIds.Contains(existing.HallId) && slots.Any(slot =>
                slot.HallId == existing.HallId &&
                slot.IsoWeekday == existing.IsoWeekday &&
                ScheduleTimeRangePolicy.Overlaps(slot.StartTime, slot.DurationMinutes, existing.StartTime, existing.DurationMinutes)))
            ? [new ScheduleWarningResponse("lesson_hall_overlap", global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine4804ea9330e)]
            : [];
    }

    private static async Task<GroupLessonSeriesImpactResponse> BuildImpactAsync(
        LessonSeries series,
        DateOnly effectiveFrom,
        DateOnly? endsOn,
        IReadOnlyList<LessonSeriesSlotCandidate> slots,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var to = MinDate(endsOn ?? effectiveFrom.AddDays(MaxImpactProjectionDays - 1), effectiveFrom.AddDays(MaxImpactProjectionDays - 1));
        var affected = new List<GroupLessonSeriesAffectedOccurrenceResponse>();
        foreach (var day in EachDay(effectiveFrom, to))
        {
            foreach (var slot in slots.Where(slot => slot.IsoWeekday == ToIsoWeekday(day)))
            {
                affected.Add(new GroupLessonSeriesAffectedOccurrenceResponse(
                    LessonOccurrenceIdPolicy.CreateRecurring(ResolvePreviewLineage(series, slot), day),
                    day,
                    slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                    slot.HallId,
                    slot.HallName));
            }
        }

        var skipped = (await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.GroupId == series.GroupId &&
                occurrence.LessonDate >= effectiveFrom &&
                occurrence.LessonDate <= to &&
                (occurrence.Status == LessonOccurrenceStatus.Cancelled ||
                    occurrence.SourceKind != LessonOccurrenceSourceKind.Recurring ||
                    occurrence.ProjectedDate != occurrence.LessonDate))
            .OrderBy(occurrence => occurrence.LessonDate)
            .ThenBy(occurrence => occurrence.StartTime)
            .ThenBy(occurrence => occurrence.Id)
            .Take(MaxImpactExamples)
            .ToArrayAsync(cancellationToken))
            .Select(occurrence => new GroupLessonSeriesSkippedOccurrenceResponse(
                occurrence.Id,
                occurrence.LessonDate,
                occurrence.Status == LessonOccurrenceStatus.Cancelled ? "materialized-cancelled" : "materialized-exception"))
            .Take(MaxImpactExamples)
            .ToArray();

        return new GroupLessonSeriesImpactResponse(
            affected.Count,
            affected
                .OrderBy(item => item.LessonDate)
                .ThenBy(item => item.StartTime, StringComparer.Ordinal)
                .ThenBy(item => item.LessonOccurrenceId)
                .Take(MaxImpactExamples)
                .ToArray(),
            skipped);
    }

    private static void ApplyReplacementVersion(
        LessonSeries series,
        LessonSeriesValidation parsed,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        var boundary = parsed.EffectiveFrom;
        var referencedRuleIds = dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.GroupId == series.GroupId &&
                occurrence.LessonDate >= boundary &&
                occurrence.SourceRuleVersionId != null)
            .Select(occurrence => occurrence.SourceRuleVersionId!.Value)
            .ToHashSet();

        foreach (var version in series.RuleVersions.ToArray())
        {
            if (version.EffectiveFrom >= boundary)
            {
                if (!referencedRuleIds.Contains(version.Id))
                {
                    dbContext.LessonScheduleRuleVersions.Remove(version);
                }

                continue;
            }

            if (version.EffectiveTo is null || version.EffectiveTo >= boundary)
            {
                version.EffectiveTo = boundary.AddDays(-1);
            }
        }

        series.EndsOn = parsed.EndsOn;
        series.UpdatedAt = now;
        var versionNumber = series.RuleVersions.Select(version => version.VersionNumber).DefaultIfEmpty(0).Max() + 1;
        var replacement = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = series.Id,
            VersionNumber = versionNumber,
            EffectiveFrom = boundary,
            EffectiveTo = parsed.EndsOn,
            CreatedAt = now
        };

        var previousSlots = series.RuleVersions
            .SelectMany(version => version.Slots)
            .OrderBy(slot => slot.IsoWeekday)
            .ThenBy(slot => slot.StartTime)
            .ThenBy(slot => slot.HallId)
            .ToArray();
        for (var index = 0; index < parsed.Slots.Count; index++)
        {
            var slot = parsed.Slots[index];
            var previous = index < previousSlots.Length && previousSlots[index].IsoWeekday == slot.IsoWeekday
                ? previousSlots[index]
                : null;
            replacement.Slots.Add(new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                LessonScheduleRuleVersionId = replacement.Id,
                SlotLineageId = previous?.SlotLineageId ?? Guid.NewGuid(),
                IsoWeekday = slot.IsoWeekday,
                StartTime = slot.StartTime,
                DurationMinutes = slot.DurationMinutes,
                HallId = slot.HallId,
                CreatedAt = now
            });
        }

        dbContext.LessonScheduleRuleVersions.Add(replacement);
    }

    private static GroupLessonSeriesConfirmationPayload CreatePayload(
        LessonSeries series,
        LessonSeriesValidation parsed,
        string revision,
        IReadOnlyList<ScheduleWarningResponse> warnings)
    {
        return new GroupLessonSeriesConfirmationPayload(
            series.GroupId,
            series.Id,
            parsed.Scope,
            parsed.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            parsed.EndsOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            revision,
            parsed.Slots.Select(slot => new GroupLessonSeriesSlotConfirmationPayload(
                    slot.IsoWeekday,
                    slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                    slot.DurationMinutes,
                    slot.HallId))
                .ToArray(),
            warnings.Select(warning => warning.Code).Order(StringComparer.Ordinal).ToArray());
    }

    private static IReadOnlyList<GroupLessonSeriesSlotResponse> MapSlots(IEnumerable<LessonSeriesSlotCandidate> slots)
    {
        return slots
            .Select(slot => new GroupLessonSeriesSlotResponse(
                slot.IsoWeekday,
                slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                slot.DurationMinutes,
                slot.HallId,
                slot.HallName))
            .ToArray();
    }

    private static GroupLessonSeriesReadResponse MapReadResponse(LessonSeries series, DateOnly businessDate)
    {
        var editDate = MaxDate(series.StartsOn, businessDate);
        var currentVersion = ResolveCurrentOrNextVersion(series, editDate)
            ?? throw new InvalidOperationException($"Lesson series '{series.Id}' does not contain rule versions.");
        var slots = currentVersion.Slots
            .OrderBy(slot => slot.IsoWeekday)
            .ThenBy(slot => slot.StartTime)
            .ThenBy(slot => slot.Hall.Name)
            .ThenBy(slot => slot.HallId)
            .Select(slot => new GroupLessonSeriesSlotResponse(
                slot.IsoWeekday,
                slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                slot.DurationMinutes,
                slot.HallId,
                slot.Hall.Name))
            .ToArray();

        return new GroupLessonSeriesReadResponse(
            series.Id,
            series.GroupId,
            series.Group.Name,
            businessDate,
            series.StartsOn,
            series.EndsOn,
            BuildRevision(series),
            new GroupLessonSeriesCurrentVersionResponse(
                currentVersion.VersionNumber,
                currentVersion.EffectiveFrom,
                currentVersion.EffectiveTo,
                editDate,
                MaxDate(series.StartsOn, businessDate),
                slots));
    }

    private static LessonScheduleRuleVersion? ResolveCurrentOrNextVersion(LessonSeries series, DateOnly editDate)
    {
        var versions = series.RuleVersions
            .OrderBy(version => version.EffectiveFrom)
            .ThenBy(version => version.VersionNumber)
            .ToArray();
        return versions.FirstOrDefault(version =>
                version.EffectiveFrom <= editDate &&
                (version.EffectiveTo is null || version.EffectiveTo >= editDate))
            ?? versions.FirstOrDefault(version => version.EffectiveFrom > editDate)
            ?? versions.LastOrDefault();
    }

    private static object CreateAuditState(LessonSeries series)
    {
        return new
        {
            series.Id,
            series.GroupId,
            series.StartsOn,
            series.EndsOn,
            RuleVersions = series.RuleVersions
                .OrderBy(version => version.VersionNumber)
                .Select(version => new
                {
                    version.Id,
                    version.VersionNumber,
                    version.EffectiveFrom,
                    version.EffectiveTo,
                    Slots = version.Slots
                        .OrderBy(slot => slot.IsoWeekday)
                        .ThenBy(slot => slot.StartTime)
                        .Select(slot => new
                        {
                            slot.Id,
                            slot.SlotLineageId,
                            slot.IsoWeekday,
                            slot.StartTime,
                            slot.DurationMinutes,
                            slot.HallId
                        })
                        .ToArray()
                })
                .ToArray()
        };
    }

    private static string BuildRevision(LessonSeries series)
    {
        var canonical = string.Join(
            "|",
            series.Id.ToString("D"),
            series.GroupId.ToString("D"),
            series.StartsOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            series.EndsOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
            string.Join(
                ";",
                series.RuleVersions
                    .OrderBy(version => version.VersionNumber)
                    .Select(version => string.Join(
                        ",",
                        version.Id.ToString("D"),
                        version.VersionNumber.ToString(CultureInfo.InvariantCulture),
                        version.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        version.EffectiveTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                        string.Join(
                            ":",
                            version.Slots
                                .OrderBy(slot => slot.IsoWeekday)
                                .ThenBy(slot => slot.StartTime)
                                .ThenBy(slot => slot.HallId)
                                .Select(slot => string.Join(
                                    "/",
                                    slot.SlotLineageId.ToString("D"),
                                    slot.IsoWeekday.ToString(CultureInfo.InvariantCulture),
                                    slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                                    slot.DurationMinutes.ToString(CultureInfo.InvariantCulture),
                                    slot.HallId.ToString("D"))))))));

        return Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static Guid ResolvePreviewLineage(LessonSeries series, LessonSeriesSlotCandidate slot)
    {
        return series.RuleVersions
            .SelectMany(version => version.Slots)
            .OrderBy(existing => existing.IsoWeekday)
            .ThenBy(existing => existing.StartTime)
            .ThenBy(existing => existing.HallId)
            .FirstOrDefault(existing => existing.IsoWeekday == slot.IsoWeekday)
            ?.SlotLineageId ?? Guid.Empty;
    }

    private static bool TryParseDate(string? value, out DateOnly result)
    {
        return DateOnly.TryParseExact(value?.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out result);
    }

    private static IEnumerable<DateOnly> EachDay(DateOnly from, DateOnly to)
    {
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            yield return day;
        }
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private static DateOnly MinDate(DateOnly left, DateOnly right) => left <= right ? left : right;
    private static DateOnly MaxDate(DateOnly left, DateOnly right) => left >= right ? left : right;

    private static ProblemHttpResult CreateLessonSeriesProblem(string code, int statusCode)
    {
        return TypedResults.Problem(new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = $"/problems/{code}",
            Title = global::GymCrm.Api.UserFacingText.BE6ScheduleText.GroupLessonSeriesEndpointsLine805969f994a,
            Status = statusCode,
            Extensions =
            {
                ["code"] = code
            }
        });
    }

    private static async Task<IDbContextTransaction?> BeginTransactionIfSupportedAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private sealed record LessonSeriesValidation(
        Dictionary<string, string[]> Errors,
        string Scope,
        DateOnly EffectiveFrom,
        DateOnly? EndsOn,
        IReadOnlyList<LessonSeriesSlotCandidate> Slots);

    private sealed record LessonSeriesSlotCandidate(
        int IsoWeekday,
        TimeOnly StartTime,
        int DurationMinutes,
        Guid HallId,
        string HallName);
}
