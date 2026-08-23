using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerAssignmentEndpoints
{
    private const int MaxAffectedOccurrenceExamples = 20;
    private const int MaxAffectedOccurrenceProjectionDays = 31;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static RouteGroupBuilder Map(RouteGroupBuilder group)
    {
        group.MapPost(GroupApiConstants.TrainerAssignmentsPreviewRoute, PreviewAsync);
        group.MapPost(GroupApiConstants.TrainerAssignmentsRoute, ExecuteAsync);
        return group;
    }

    private static async Task<IResult> PreviewAsync(
        Guid id,
        GroupTrainerAssignmentsPreviewRequest request,
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

        var group = await LoadGroupAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateRequestAsync(
            id,
            request.Assignments,
            businessDateProvider.Today,
            dbContext,
            cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var currentRevision = BuildRevision(group.Id, group.TrainerAssignments);
        if (!string.IsNullOrWhiteSpace(request.ExpectedRevision) &&
            !string.Equals(request.ExpectedRevision.Trim(), currentRevision, StringComparison.Ordinal))
        {
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var warnings = await BuildWarningsAsync(group.Id, parsed.Assignments, dbContext, cancellationToken);
        var impact = await BuildImpactAsync(group.Id, parsed.Assignments, dbContext, cancellationToken);
        var payload = CreatePayload(group.Id, currentRevision, parsed.Assignments, warnings);
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var payloadHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson);
        var rawToken = ScheduleMutationTokenPolicy.CreateSecureToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(ScheduleMutationTokenPolicy.ConfirmationTokenLifetime);

        dbContext.ScheduleMutationConfirmationTokens.Add(new ScheduleMutationConfirmationToken
        {
            Id = Guid.NewGuid(),
            TokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken),
            ActorUserId = currentUser.Id,
            Purpose = ScheduleMutationTokenPolicy.GroupTrainerAssignmentsPurpose,
            PayloadHash = payloadHash,
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new GroupTrainerAssignmentsPreviewResponse(
            rawToken,
            expiresAt,
            currentRevision,
            MapAssignments(parsed.Assignments),
            impact,
            warnings));
    }

    private static async Task<IResult> ExecuteAsync(
        Guid id,
        GroupTrainerAssignmentsExecuteRequest request,
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
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(request.ConfirmationToken.Trim());
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.GroupTrainerAssignmentsPurpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var group = await LoadGroupForMutationAsync(id, dbContext, cancellationToken);
        if (group is null)
        {
            return TypedResults.NotFound();
        }

        if (!GroupManagementScope.Contains(currentUser, group.BranchId))
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        var parsed = await ValidateRequestAsync(
            id,
            request.Assignments,
            businessDateProvider.Today,
            dbContext,
            cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var currentRevision = BuildRevision(group.Id, group.TrainerAssignments);
        if (!string.IsNullOrWhiteSpace(request.ExpectedRevision) &&
            !string.Equals(request.ExpectedRevision.Trim(), currentRevision, StringComparison.Ordinal))
        {
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var warnings = await BuildWarningsAsync(group.Id, parsed.Assignments, dbContext, cancellationToken);
        var payload = CreatePayload(group.Id, currentRevision, parsed.Assignments, warnings);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, payload))
        {
            return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var impact = await BuildImpactAsync(group.Id, parsed.Assignments, dbContext, cancellationToken);
        var oldState = JsonSerializer.Serialize(CreateAuditState(group.TrainerAssignments), JsonOptions);
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
                return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
            }

            if (tokenClaim == ScheduleMutationTokenClaimResult.Expired)
            {
                return CreateTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
            }

            await ApplyAssignmentsAsync(
                group,
                parsed.Assignments,
                currentUser.Id,
                now,
                businessDateProvider.Today,
                dbContext,
                cancellationToken);
            group.UpdatedAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);

            var updatedGroup = await LoadGroupAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated training group '{id}' was not found.");
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    GroupAuditConstants.TrainingGroupUpdatedAction,
                    GroupAuditConstants.TrainingGroupEntityType,
                    group.Id.ToString(),
                    GroupResources.TrainingGroupTrainersUpdatedDescription(currentUser.Login, group.Name),
                    oldState,
                    JsonSerializer.Serialize(CreateAuditState(updatedGroup.TrainerAssignments), JsonOptions)),
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

        var finalGroup = await LoadGroupAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated training group '{id}' was not found.");
        return TypedResults.Ok(new GroupTrainerAssignmentsExecuteResponse(
            BuildRevision(finalGroup.Id, finalGroup.TrainerAssignments),
            MapAssignments(finalGroup.TrainerAssignments),
            impact,
            warnings));
    }

    private static async Task<TrainingGroup?> LoadGroupAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .AsNoTracking()
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static async Task<TrainingGroup?> LoadGroupForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .Include(group => group.Trainers)
                .ThenInclude(groupTrainer => groupTrainer.Trainer)
            .Include(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .AsSplitQuery()
            .SingleOrDefaultAsync(group => group.Id == id, cancellationToken);
    }

    private static async Task<TrainerAssignmentValidation> ValidateRequestAsync(
        Guid groupId,
        IReadOnlyList<GroupTrainerAssignmentPeriodRequest>? requestAssignments,
        DateOnly today,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var parsed = new List<GroupTrainerAssignmentPeriod>();
        var rawTrainerIds = requestAssignments?.Select(assignment => assignment.TrainerId ?? Guid.Empty).ToArray();

        if (requestAssignments is null)
        {
            errors["assignments"] = ["assignments обязателен."];
            return new TrainerAssignmentValidation(errors, parsed);
        }

        for (var index = 0; index < requestAssignments.Count; index++)
        {
            var assignment = requestAssignments[index];
            var prefix = $"assignments[{index}]";
            if (!assignment.TrainerId.HasValue || assignment.TrainerId.Value == Guid.Empty)
            {
                errors[$"{prefix}.trainerId"] = [GroupResources.InvalidTrainerId];
            }

            if (!TryParseDate(assignment.ValidFrom, out var validFrom))
            {
                errors[$"{prefix}.validFrom"] = ["validFrom должен быть в формате yyyy-MM-dd."];
                continue;
            }

            DateOnly? validTo = null;
            if (!string.IsNullOrWhiteSpace(assignment.ValidTo))
            {
                if (!TryParseDate(assignment.ValidTo, out var parsedValidTo))
                {
                    errors[$"{prefix}.validTo"] = ["validTo должен быть в формате yyyy-MM-dd."];
                    continue;
                }

                validTo = parsedValidTo;
            }

            if (validFrom < today)
            {
                errors[$"{prefix}.validFrom"] = ["validFrom не может быть раньше текущей даты."];
            }

            if (validTo.HasValue && validTo.Value < validFrom)
            {
                errors[$"{prefix}.validTo"] = ["validTo должен быть не раньше validFrom."];
            }

            if (assignment.TrainerId.HasValue && assignment.TrainerId.Value != Guid.Empty)
            {
                parsed.Add(new GroupTrainerAssignmentPeriod(assignment.TrainerId.Value, string.Empty, validFrom, validTo));
            }
        }

        var normalizedTrainerIds = GroupRequestValidator.NormalizeTrainerIds(rawTrainerIds);
        foreach (var trainerError in await GroupRequestValidator.ValidateTrainerIdsAsync(rawTrainerIds, normalizedTrainerIds, dbContext, cancellationToken))
        {
            errors.TryAdd(trainerError.Key, trainerError.Value);
        }

        foreach (var overlap in parsed
                     .GroupBy(assignment => assignment.TrainerId)
                     .SelectMany(group => group.SelectMany((left, leftIndex) => group.Skip(leftIndex + 1).Select(right => (left, right))))
                     .Where(pair => DateRangesOverlap(pair.left.ValidFrom, pair.left.ValidTo, pair.right.ValidFrom, pair.right.ValidTo)))
        {
            errors["assignments"] = [$"Trainer '{overlap.left.TrainerId:D}' has overlapping assignment periods in this request."];
            break;
        }

        if (errors.Count > 0)
        {
            return new TrainerAssignmentValidation(errors, parsed);
        }

        var trainerNames = await dbContext.Users
            .AsNoTracking()
            .Where(user => normalizedTrainerIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FullName })
            .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        return new TrainerAssignmentValidation(
            errors,
            parsed
                .OrderBy(assignment => assignment.ValidFrom)
                .ThenBy(assignment => assignment.ValidTo)
                .ThenBy(assignment => assignment.TrainerId)
                .Select(assignment => assignment with { TrainerName = trainerNames[assignment.TrainerId] })
                .ToArray());
    }

    private static async Task<IReadOnlyList<ScheduleWarningResponse>> BuildWarningsAsync(
        Guid groupId,
        IReadOnlyList<GroupTrainerAssignmentPeriod> assignments,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (assignments.Count == 0)
        {
            return [];
        }

        var trainerIds = assignments.Select(assignment => assignment.TrainerId).Distinct().ToArray();
        var existing = await dbContext.GroupTrainerAssignments
            .AsNoTracking()
            .Where(assignment => assignment.GroupId != groupId && trainerIds.Contains(assignment.TrainerId))
            .ToArrayAsync(cancellationToken);

        return assignments.Any(request => existing.Any(candidate =>
            candidate.TrainerId == request.TrainerId &&
            DateRangesOverlap(request.ValidFrom, request.ValidTo, candidate.ValidFrom, candidate.ValidTo)))
            ? [new ScheduleWarningResponse("group_trainer_assignment_overlap", "У тренера есть пересекающееся постоянное назначение в другой группе.")]
            : [];
    }

    private static async Task<GroupTrainerAssignmentImpactResponse> BuildImpactAsync(
        Guid groupId,
        IReadOnlyList<GroupTrainerAssignmentPeriod> assignments,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (assignments.Count == 0)
        {
            return new GroupTrainerAssignmentImpactResponse(0, []);
        }

        var from = assignments.Min(assignment => assignment.ValidFrom);
        var latestRequestedEnd = assignments
            .Where(assignment => assignment.ValidTo.HasValue)
            .Select(assignment => assignment.ValidTo!.Value)
            .DefaultIfEmpty(from.AddDays(MaxAffectedOccurrenceProjectionDays - 1))
            .Max();
        var to = latestRequestedEnd < from.AddDays(MaxAffectedOccurrenceProjectionDays - 1)
            ? latestRequestedEnd
            : from.AddDays(MaxAffectedOccurrenceProjectionDays - 1);

        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(candidate =>
                candidate.GroupId == groupId &&
                candidate.StartsOn <= to &&
                (candidate.EndsOn == null || candidate.EndsOn >= from))
            .Include(candidate => candidate.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);

        var affected = new List<GroupTrainerAssignmentAffectedOccurrenceResponse>();
        foreach (var day in EachDay(from, to))
        {
            foreach (var version in series.SelectMany(item => item.RuleVersions).Where(version =>
                         version.EffectiveFrom <= day &&
                         (version.EffectiveTo == null || version.EffectiveTo >= day)))
            {
                foreach (var slot in version.Slots.Where(slot => slot.IsoWeekday == ToIsoWeekday(day)))
                {
                    affected.Add(new GroupTrainerAssignmentAffectedOccurrenceResponse(
                        LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, day),
                        day,
                        slot.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
                        slot.HallId,
                        slot.Hall.Name));
                }
            }
        }

        return new GroupTrainerAssignmentImpactResponse(
            affected.Count,
            affected
                .OrderBy(item => item.LessonDate)
                .ThenBy(item => item.StartTime, StringComparer.Ordinal)
                .ThenBy(item => item.LessonOccurrenceId)
                .Take(MaxAffectedOccurrenceExamples)
                .ToArray());
    }

    private static async Task ApplyAssignmentsAsync(
        TrainingGroup group,
        IReadOnlyList<GroupTrainerAssignmentPeriod> requestedAssignments,
        Guid currentUserId,
        DateTimeOffset now,
        DateOnly today,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var effectiveFrom = requestedAssignments.Count == 0
            ? today
            : requestedAssignments.Min(assignment => assignment.ValidFrom);
        var dayBeforeEffectiveFrom = effectiveFrom.AddDays(-1);

        var futureAssignments = await dbContext.GroupTrainerAssignments
            .Where(assignment => assignment.GroupId == group.Id && assignment.ValidFrom >= effectiveFrom)
            .ToListAsync(cancellationToken);
        dbContext.GroupTrainerAssignments.RemoveRange(futureAssignments);

        var overlappingAssignments = await dbContext.GroupTrainerAssignments
            .Where(assignment =>
                assignment.GroupId == group.Id &&
                assignment.ValidFrom < effectiveFrom &&
                (assignment.ValidTo == null || assignment.ValidTo >= effectiveFrom))
            .ToListAsync(cancellationToken);
        foreach (var assignment in overlappingAssignments)
        {
            assignment.ValidTo = dayBeforeEffectiveFrom;
        }

        foreach (var requested in requestedAssignments)
        {
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = requested.TrainerId,
                ValidFrom = requested.ValidFrom,
                ValidTo = requested.ValidTo,
                CreatedByUserId = currentUserId,
                CreatedAt = now
            });
        }

        var activeTodayTrainerIds = (await dbContext.GroupTrainerAssignments
                .AsNoTracking()
                .Where(assignment =>
                    assignment.GroupId == group.Id &&
                    assignment.ValidFrom <= today &&
                    (assignment.ValidTo == null || assignment.ValidTo >= today))
                .Select(assignment => assignment.TrainerId)
                .ToArrayAsync(cancellationToken))
            .Concat(requestedAssignments
                .Where(assignment =>
                    assignment.ValidFrom <= today &&
                    (assignment.ValidTo is null || assignment.ValidTo >= today))
                .Select(assignment => assignment.TrainerId))
            .Distinct()
            .ToHashSet();

        foreach (var trainer in group.Trainers.ToArray())
        {
            if (!activeTodayTrainerIds.Contains(trainer.TrainerId))
            {
                dbContext.GroupTrainers.Remove(trainer);
                group.Trainers.Remove(trainer);
            }
        }

        var currentTrainerIds = group.Trainers.Select(trainer => trainer.TrainerId).ToHashSet();
        foreach (var trainerId in activeTodayTrainerIds.Where(trainerId => !currentTrainerIds.Contains(trainerId)))
        {
            group.Trainers.Add(new GroupTrainer
            {
                GroupId = group.Id,
                TrainerId = trainerId
            });
        }
    }

    private static GroupTrainerAssignmentsConfirmationPayload CreatePayload(
        Guid groupId,
        string expectedRevision,
        IReadOnlyList<GroupTrainerAssignmentPeriod> assignments,
        IReadOnlyList<ScheduleWarningResponse> warnings)
    {
        return new GroupTrainerAssignmentsConfirmationPayload(
            groupId,
            expectedRevision,
            assignments
                .OrderBy(assignment => assignment.ValidFrom)
                .ThenBy(assignment => assignment.ValidTo)
                .ThenBy(assignment => assignment.TrainerId)
                .Select(assignment => new GroupTrainerAssignmentConfirmationPayload(
                    assignment.TrainerId,
                    assignment.ValidFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    assignment.ValidTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
                .ToArray(),
            warnings.Select(warning => warning.Code).Order(StringComparer.Ordinal).ToArray());
    }

    private static IReadOnlyList<GroupTrainerAssignmentPeriodResponse> MapAssignments(
        IEnumerable<GroupTrainerAssignmentPeriod> assignments)
    {
        return assignments
            .OrderBy(assignment => assignment.ValidFrom)
            .ThenBy(assignment => assignment.ValidTo)
            .ThenBy(assignment => assignment.TrainerName, StringComparer.CurrentCulture)
            .ThenBy(assignment => assignment.TrainerId)
            .Select(assignment => new GroupTrainerAssignmentPeriodResponse(
                assignment.TrainerId,
                assignment.TrainerName,
                assignment.ValidFrom,
                assignment.ValidTo))
            .ToArray();
    }

    private static IReadOnlyList<GroupTrainerAssignmentPeriodResponse> MapAssignments(
        IEnumerable<GroupTrainerAssignment> assignments)
    {
        return assignments
            .OrderBy(assignment => assignment.ValidFrom)
            .ThenBy(assignment => assignment.ValidTo)
            .ThenBy(assignment => assignment.Trainer.FullName, StringComparer.CurrentCulture)
            .ThenBy(assignment => assignment.TrainerId)
            .Select(assignment => new GroupTrainerAssignmentPeriodResponse(
                assignment.TrainerId,
                assignment.Trainer.FullName,
                assignment.ValidFrom,
                assignment.ValidTo))
            .ToArray();
    }

    private static object CreateAuditState(IEnumerable<GroupTrainerAssignment> assignments)
    {
        return assignments
            .OrderBy(assignment => assignment.ValidFrom)
            .ThenBy(assignment => assignment.ValidTo)
            .ThenBy(assignment => assignment.TrainerId)
            .Select(assignment => new
            {
                assignment.TrainerId,
                assignment.ValidFrom,
                assignment.ValidTo
            })
            .ToArray();
    }

    private static string BuildRevision(Guid groupId, IEnumerable<GroupTrainerAssignment> assignments)
    {
        var canonical = string.Join(
            "|",
            groupId.ToString("D"),
            string.Join(
                ";",
                assignments
                    .OrderBy(assignment => assignment.ValidFrom)
                    .ThenBy(assignment => assignment.ValidTo)
                    .ThenBy(assignment => assignment.TrainerId)
                    .Select(assignment => string.Join(
                        ",",
                        assignment.TrainerId.ToString("D"),
                        assignment.ValidFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        assignment.ValidTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty))));

        return Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static bool TryParseDate(string? value, out DateOnly result)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out result);
    }

    private static bool DateRangesOverlap(DateOnly leftFrom, DateOnly? leftTo, DateOnly rightFrom, DateOnly? rightTo)
    {
        return leftFrom <= (rightTo ?? DateOnly.MaxValue) && rightFrom <= (leftTo ?? DateOnly.MaxValue);
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

    private static ProblemHttpResult CreateTokenProblem(string code, int statusCode)
    {
        return TypedResults.Problem(new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = $"/problems/{code}",
            Title = "Group trainer assignment preview token is not valid for this mutation.",
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

    private sealed record TrainerAssignmentValidation(
        Dictionary<string, string[]> Errors,
        IReadOnlyList<GroupTrainerAssignmentPeriod> Assignments);

    private sealed record GroupTrainerAssignmentPeriod(
        Guid TrainerId,
        string TrainerName,
        DateOnly ValidFrom,
        DateOnly? ValidTo);
}
