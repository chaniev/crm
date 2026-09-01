using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static partial class ScheduleEndpoints
{
    private const string LessonDateFormat = "yyyy-MM-dd";
    private const int MaxCalendarRangeDays = 31;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapScheduleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(ScheduleApiConstants.RoutePrefix)
            .RequireAuthorization();

        group.MapGet(ScheduleApiConstants.GroupsRoute, ListGroupsAsync);
        group.MapGet(ScheduleApiConstants.LessonsRoute, ListLessonsAsync);
        group.MapGet(ScheduleApiConstants.LessonByIdRoute, GetLessonAsync);
        group.MapPost(ScheduleApiConstants.CancellationLessonPreviewRoute, PreviewLessonCancellationAsync);
        group.MapPost(ScheduleApiConstants.CancellationLessonRoute, ApplyLessonCancellationAsync);
        group.MapPost(ScheduleApiConstants.ChangeLessonPreviewRoute, PreviewLessonChangeAsync);
        group.MapPost(ScheduleApiConstants.ChangeLessonRoute, ChangeLessonAsync);
        group.MapPost(ScheduleApiConstants.OneOffLessonPreviewRoute, PreviewOneOffLessonAsync);
        group.MapPost(ScheduleApiConstants.OneOffLessonsRoute, CreateOneOffLessonAsync);
        group.MapPost(ScheduleApiConstants.LessonTrainerSubstitutionsPreviewRoute, PreviewLessonTrainerSubstitutionsAsync);
        group.MapPost(ScheduleApiConstants.LessonTrainerSubstitutionsRoute, ApplyLessonTrainerSubstitutionsAsync);
        group.MapPost(ScheduleApiConstants.LessonTrainerSubstitutionCancellationsPreviewRoute, PreviewLessonTrainerSubstitutionCancellationsAsync);
        group.MapPost(ScheduleApiConstants.LessonTrainerSubstitutionCancellationsRoute, ApplyLessonTrainerSubstitutionCancellationsAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<ScheduleLessonsResponse>, ValidationProblem, UnauthorizedHttpResult>> ListLessonsAsync(
        string? from,
        string? to,
        Guid? branchId,
        Guid? hallId,
        Guid? trainerId,
        Guid? groupId,
        Guid? groupTypeId,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var range = ParseRange(from, to);
        if (range is null)
        {
            return CreateCalendarRangeValidationProblem();
        }

        var scopedSeries = await LoadScopedSeriesAsync(
            currentUser,
            range.Value.From,
            range.Value.To,
            dbContext,
            accessScopeService,
            cancellationToken);
        var filterOptions = BuildFilterOptions(scopedSeries);

        var series = scopedSeries.AsEnumerable();
        if (branchId.HasValue)
        {
            series = series.Where(item => item.Group.BranchId == branchId.Value);
        }

        if (hallId.HasValue)
        {
            series = series.Where(item => item.RuleVersions.Any(version =>
                version.Slots.Any(slot => slot.HallId == hallId.Value)));
        }

        if (groupId.HasValue)
        {
            series = series.Where(item => item.GroupId == groupId.Value);
        }

        if (groupTypeId.HasValue)
        {
            series = series.Where(item => item.Group.GroupTypeId == groupTypeId.Value);
        }

        var attendanceMarks = await LoadAttendanceMarkFactsAsync(
            dbContext,
            range.Value.From,
            range.Value.To,
            cancellationToken);
        var materialized = await LoadMaterializedOccurrencesAsync(
            dbContext,
            series.Select(item => item.GroupId).ToHashSet(),
            await LoadAccessibleSubstituteOccurrenceIdsAsync(
                dbContext,
                currentUser,
                range.Value.From,
                range.Value.To,
                cancellationToken),
            range.Value.From,
            range.Value.To,
            cancellationToken);

        var items = ProjectLessons(
                series,
                materialized,
                range.Value.From,
                range.Value.To,
                currentUser,
                attendanceDatePolicy,
                attendanceMarks)
            .Where(lesson => !trainerId.HasValue ||
                lesson.EffectiveTrainers.Any(trainer => trainer.TrainerId == trainerId.Value))
            .OrderBy(lesson => lesson.LessonDate)
            .ThenBy(lesson => lesson.StartTime, StringComparer.Ordinal)
            .ThenBy(lesson => lesson.GroupName, StringComparer.CurrentCulture)
            .ThenBy(lesson => lesson.LessonOccurrenceId)
            .ToArray();

        return TypedResults.Ok(new ScheduleLessonsResponse(
            range.Value.From,
            range.Value.To,
            items,
            BuildCapabilities(currentUser),
            filterOptions));
    }

    private static async Task<Results<Ok<ScheduleLessonResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> GetLessonAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var parsedDate = ParseDate(lessonDate);
        if (!parsedDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var scopedSeries = await LoadScopedSeriesAsync(
            currentUser,
            parsedDate.Value,
            parsedDate.Value,
            dbContext,
            accessScopeService,
            cancellationToken);
        var attendanceMarks = await LoadAttendanceMarkFactsAsync(
            dbContext,
            parsedDate.Value,
            parsedDate.Value,
            cancellationToken);
        var materialized = await LoadMaterializedOccurrencesAsync(
            dbContext,
            scopedSeries.Select(item => item.GroupId).ToHashSet(),
            await LoadAccessibleSubstituteOccurrenceIdsAsync(
                dbContext,
                currentUser,
                parsedDate.Value,
                parsedDate.Value,
                cancellationToken),
            parsedDate.Value,
            parsedDate.Value,
            cancellationToken);
        var lesson = ProjectLessons(
                scopedSeries,
                materialized,
                parsedDate.Value,
                parsedDate.Value,
                currentUser,
                attendanceDatePolicy,
                attendanceMarks)
            .SingleOrDefault(candidate => candidate.LessonOccurrenceId == lessonOccurrenceId);

        return lesson is null
            ? CreateOccurrenceNotFoundProblem()
            : TypedResults.Ok(lesson);
    }

    internal static async Task<IReadOnlyList<ScheduleLessonResponse>> LoadScopedLessonsAsync(
        User currentUser,
        DateOnly from,
        DateOnly to,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        CancellationToken cancellationToken)
    {
        var scopedSeries = await LoadScopedSeriesAsync(
            currentUser,
            from,
            to,
            dbContext,
            accessScopeService,
            cancellationToken);
        var attendanceMarks = await LoadAttendanceMarkFactsAsync(
            dbContext,
            from,
            to,
            cancellationToken);
        var materialized = await LoadMaterializedOccurrencesAsync(
            dbContext,
            scopedSeries.Select(item => item.GroupId).ToHashSet(),
            await LoadAccessibleSubstituteOccurrenceIdsAsync(
                dbContext,
                currentUser,
                from,
                to,
                cancellationToken),
            from,
            to,
            cancellationToken);

        return ProjectLessons(
                scopedSeries,
                materialized,
                from,
                to,
                currentUser,
                attendanceDatePolicy,
                attendanceMarks)
            .ToArray();
    }

    private static async Task<IResult> PreviewOneOffLessonAsync(
        ScheduleOneOffLessonRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        var parsed = await ValidateOneOffLessonRequestAsync(
            new ScheduleOneOffLessonRequest(
                request.GroupId,
                request.LessonDate,
                request.StartTime,
                request.DurationMinutes,
                request.HallId),
            currentUser,
            dbContext,
            cancellationToken);
        if (parsed.Forbidden)
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var conflict = await ValidateOneOffOverlapAsync(
            parsed.Group!.Id,
            parsed.LessonDate!.Value,
            parsed.StartTime!.Value,
            parsed.DurationMinutes!.Value,
            dbContext,
            cancellationToken);
        if (conflict is not null)
        {
            return conflict;
        }

        var occurrenceId = Guid.NewGuid();
        var payload = CreateOneOffPayload(
            occurrenceId,
            parsed.Group.Id,
            parsed.LessonDate.Value,
            parsed.StartTime.Value,
            parsed.DurationMinutes.Value,
            parsed.Hall!.Id);
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
            Purpose = ScheduleMutationTokenPolicy.OneOffCreatePurpose,
            PayloadHash = payloadHash,
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        var lesson = MapLesson(
            occurrenceId,
            LessonOccurrenceSourceKind.OneOff.ToString(),
            false,
            null,
            parsed.LessonDate.Value,
            parsed.StartTime.Value,
            parsed.DurationMinutes.Value,
            parsed.Group,
            parsed.Hall,
            LessonOccurrenceStatus.Scheduled.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"preview:{payloadHash}");

        return TypedResults.Ok(new ScheduleOneOffLessonPreviewResponse(
            rawToken,
            expiresAt,
            lesson,
            []));
    }

    private static async Task<IResult> CreateOneOffLessonAsync(
        ScheduleOneOffLessonExecuteRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmationToken))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var parsed = await ValidateOneOffLessonRequestAsync(
            new ScheduleOneOffLessonRequest(
                request.GroupId,
                request.LessonDate,
                request.StartTime,
                request.DurationMinutes,
                request.HallId),
            currentUser,
            dbContext,
            cancellationToken);
        if (parsed.Forbidden)
        {
            return GroupManagementScope.ForbiddenProblem();
        }

        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var rawToken = request.ConfirmationToken.Trim();
        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken);
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.OneOffCreatePurpose,
                cancellationToken);
        if (token is null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ConsumedAt is not null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        if (token.ExpiresAt <= now)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var payload = ScheduleMutationTokenPolicy.DeserializePayload(token.PayloadJson)
            ?? throw new InvalidOperationException($"Schedule confirmation token '{token.Id}' payload was empty.");
        var requestPayload = CreateOneOffPayload(
            payload.OccurrenceId,
            parsed.Group!.Id,
            parsed.LessonDate!.Value,
            parsed.StartTime!.Value,
            parsed.DurationMinutes!.Value,
            parsed.Hall!.Id);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, requestPayload))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var conflict = await ValidateOneOffOverlapAsync(
            parsed.Group.Id,
            parsed.LessonDate.Value,
            parsed.StartTime.Value,
            parsed.DurationMinutes.Value,
            dbContext,
            cancellationToken);
        if (conflict is not null)
        {
            return conflict;
        }

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

        var occurrence = new LessonOccurrence
        {
            Id = payload.OccurrenceId,
            GroupId = parsed.Group.Id,
            LessonDate = parsed.LessonDate.Value,
            StartTime = parsed.StartTime.Value,
            DurationMinutes = parsed.DurationMinutes.Value,
            HallId = parsed.Hall.Id,
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = LessonOccurrenceSourceKind.OneOff,
            CreatedAt = now,
            UpdatedAt = now
        };
        dbContext.LessonOccurrences.Add(occurrence);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "LessonOccurrenceCreated",
                "LessonOccurrence",
                occurrence.Id.ToString(),
                $"Пользователь '{currentUser.Login}' создал разовое занятие.",
                NewValueJson: JsonSerializer.Serialize(CreateLessonOccurrenceAuditState(occurrence), JsonOptions)),
            cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var lesson = MapLesson(
            occurrence.Id,
            occurrence.SourceKind.ToString(),
            true,
            occurrence.SourceLessonSeriesId,
            occurrence.LessonDate,
            occurrence.StartTime,
            occurrence.DurationMinutes,
            parsed.Group,
            parsed.Hall,
            occurrence.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"{occurrence.Id:D}:{occurrence.Version}");

        return TypedResults.Created(
            $"{ScheduleApiConstants.RoutePrefix}{ScheduleApiConstants.LessonsRoute}/{occurrence.Id}?lessonDate={occurrence.LessonDate:yyyy-MM-dd}",
            lesson);
    }

    private static async Task<IResult> CancelLessonAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonMutationRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        var parsedDate = ParseDate(lessonDate);
        if (!parsedDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, parsedDate.Value, currentUser, dbContext, cancellationToken);
        if (target is null)
        {
            return CreateOccurrenceNotFoundProblem();
        }

        var hasAttendanceMarks = await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken);
        var currentLesson = MapResolvedMutationTarget(target, currentUser, attendanceDatePolicy, hasAttendanceMarks);
        if (!string.IsNullOrWhiteSpace(request.Revision) &&
            !string.Equals(request.Revision.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        if (target.Status == LessonOccurrenceStatus.Cancelled)
        {
            return CreateLessonMutationProblem("lesson-not-scheduled", StatusCodes.Status409Conflict);
        }

        if (hasAttendanceMarks)
        {
            return CreateLessonMutationProblem("lesson-attendance-state-conflict", StatusCodes.Status409Conflict);
        }

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        LessonOccurrence occurrence;
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

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "LessonOccurrenceCancelled",
                "LessonOccurrence",
                occurrence.Id.ToString(),
                $"Пользователь '{currentUser.Login}' отменил занятие.",
                OldValueJson: JsonSerializer.Serialize(new { Status = LessonOccurrenceStatus.Scheduled.ToString() }, JsonOptions),
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

    private static async Task<IResult> RestoreLessonAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonMutationRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        var parsedDate = ParseDate(lessonDate);
        if (!parsedDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, parsedDate.Value, currentUser, dbContext, cancellationToken);
        if (target?.Occurrence is null)
        {
            return CreateOccurrenceNotFoundProblem();
        }

        var currentLesson = MapResolvedMutationTarget(
            target,
            currentUser,
            attendanceDatePolicy,
            await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken));
        if (!string.IsNullOrWhiteSpace(request.Revision) &&
            !string.Equals(request.Revision.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        if (target.Status != LessonOccurrenceStatus.Cancelled)
        {
            return CreateLessonMutationProblem("lesson-not-cancelled", StatusCodes.Status409Conflict);
        }

        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        target.Occurrence.Status = LessonOccurrenceStatus.Scheduled;
        target.Occurrence.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "LessonOccurrenceRestored",
                "LessonOccurrence",
                target.Occurrence.Id.ToString(),
                $"Пользователь '{currentUser.Login}' восстановил занятие.",
                OldValueJson: JsonSerializer.Serialize(new { Status = LessonOccurrenceStatus.Cancelled.ToString() }, JsonOptions),
                NewValueJson: JsonSerializer.Serialize(CreateLessonOccurrenceAuditState(target.Occurrence), JsonOptions)),
            cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return TypedResults.Ok(MapLesson(
            target.Occurrence.Id,
            target.Occurrence.SourceKind.ToString(),
            true,
            target.Occurrence.SourceLessonSeriesId,
            target.Occurrence.LessonDate,
            target.Occurrence.StartTime,
            target.Occurrence.DurationMinutes,
            target.Group,
            target.Hall,
            target.Occurrence.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"{target.Occurrence.Id:D}:{target.Occurrence.Version}"));
    }

    private static async Task<IResult> PreviewLessonCancellationAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonCancellationPreviewRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        var locatorDate = ParseDate(lessonDate);
        if (!locatorDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, locatorDate.Value, currentUser, dbContext, cancellationToken);
        if (target is null)
        {
            return CreateOccurrenceNotFoundProblem();
        }

        var action = NormalizeCancellationAction(request.Action);
        if (action is null || string.IsNullOrWhiteSpace(request.ExpectedRevision))
        {
            var errors = new Dictionary<string, string[]>();
            if (action is null)
            {
                errors["action"] = ["Action должен быть Cancel или Restore."];
            }

            if (string.IsNullOrWhiteSpace(request.ExpectedRevision))
            {
                errors["expectedRevision"] = ["expectedRevision обязателен."];
            }

            return TypedResults.ValidationProblem(errors);
        }

        var currentLesson = MapResolvedMutationTarget(
            target,
            currentUser,
            attendanceDatePolicy,
            await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken));
        if (!string.Equals(request.ExpectedRevision.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var validationProblem = await ValidateCancellationStateAsync(target, action, dbContext, cancellationToken);
        if (validationProblem is not null)
        {
            return validationProblem;
        }

        var payload = CreateCancellationPayload(target.OccurrenceId, locatorDate.Value, action, request.ExpectedRevision, target.Status);
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
            Purpose = ScheduleMutationTokenPolicy.OccurrenceCancellationPurpose,
            PayloadHash = payloadHash,
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new ScheduleLessonCancellationPreviewResponse(
            rawToken,
            expiresAt,
            action,
            currentLesson));
    }

    private static async Task<IResult> ApplyLessonCancellationAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonCancellationExecuteRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmationToken))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var locatorDate = ParseDate(lessonDate);
        if (!locatorDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var rawToken = request.ConfirmationToken.Trim();
        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken);
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.OccurrenceCancellationPurpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var action = NormalizeCancellationAction(request.Action);
        if (action is null || string.IsNullOrWhiteSpace(request.ExpectedRevision))
        {
            var errors = new Dictionary<string, string[]>();
            if (action is null)
            {
                errors["action"] = ["Action должен быть Cancel или Restore."];
            }

            if (string.IsNullOrWhiteSpace(request.ExpectedRevision))
            {
                errors["expectedRevision"] = ["expectedRevision обязателен."];
            }

            return TypedResults.ValidationProblem(errors);
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, locatorDate.Value, currentUser, dbContext, cancellationToken);
        if (target is null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var currentLesson = MapResolvedMutationTarget(
            target,
            currentUser,
            attendanceDatePolicy,
            await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken));
        if (!string.Equals(request.ExpectedRevision.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var validationProblem = await ValidateCancellationStateAsync(target, action, dbContext, cancellationToken);
        if (validationProblem is not null)
        {
            return validationProblem;
        }

        var requestPayload = CreateCancellationPayload(target.OccurrenceId, locatorDate.Value, action, request.ExpectedRevision, target.Status);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, requestPayload))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        return await ApplyCancellationMutationAsync(
            target,
            action,
            currentUser,
            attendanceDatePolicy,
            auditLogService,
            token,
            now,
            dbContext,
            cancellationToken);
    }

    private static async Task<IResult> PreviewLessonChangeAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonChangePreviewRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        var locatorDate = ParseDate(lessonDate);
        if (!locatorDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, locatorDate.Value, currentUser, dbContext, cancellationToken);
        if (target is null)
        {
            return CreateOccurrenceNotFoundProblem();
        }

        var parsed = await ValidateLessonChangeRequestAsync(request, target, dbContext, cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var hasAttendanceMarks = await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken);
        var currentLesson = MapResolvedMutationTarget(target, currentUser, attendanceDatePolicy, hasAttendanceMarks);
        if (!string.Equals(request.ExpectedRevision?.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        if (parsed.Scope == "Occurrence" &&
            (target.Status == LessonOccurrenceStatus.Cancelled ||
                hasAttendanceMarks))
        {
            return CreateLessonMutationProblem("lesson-attendance-state-conflict", StatusCodes.Status409Conflict);
        }

        var hardConflict = await ValidateLessonChangeHardOverlapAsync(target, parsed, dbContext, cancellationToken);
        if (hardConflict is not null)
        {
            return hardConflict;
        }

        var warnings = await BuildLessonChangeWarningsAsync(target, parsed, dbContext, cancellationToken);
        var impact = await BuildLessonChangeImpactAsync(
            target,
            parsed,
            currentUser,
            attendanceDatePolicy,
            dbContext,
            cancellationToken);
        var payload = CreateChangePayload(target.OccurrenceId, locatorDate.Value, request.ExpectedRevision!, parsed, warnings);
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
            Purpose = ScheduleMutationTokenPolicy.OccurrenceChangePurpose,
            PayloadHash = payloadHash,
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new ScheduleLessonChangePreviewResponse(
            rawToken,
            expiresAt,
            MapLesson(
                target.OccurrenceId,
                target.SourceKind.ToString(),
                target.Occurrence is not null,
                target.Series?.Id ?? target.Occurrence?.SourceLessonSeriesId,
                parsed.NewLessonDate!.Value,
                parsed.StartTime!.Value,
                parsed.DurationMinutes!.Value,
                target.Group,
                parsed.Hall!,
                target.Status.ToString(),
                currentUser,
                attendanceDatePolicy,
                new HashSet<Guid>(),
                $"preview-change:{payloadHash}"),
            warnings,
            impact));
    }

    private static async Task<IResult> ChangeLessonAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        ScheduleLessonChangeExecuteRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAuditLogService auditLogService,
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

        if (!UserRoleAuthorizationPolicy.HasCapability(currentUser.Role, CrmCapability.ManageGroups))
        {
            return TypedResults.Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmationToken))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var locatorDate = ParseDate(lessonDate);
        if (!locatorDate.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
            });
        }

        var rawToken = request.ConfirmationToken.Trim();
        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken);
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == currentUser.Id &&
                candidate.Purpose == ScheduleMutationTokenPolicy.OccurrenceChangePurpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict);
        }

        var target = await ResolveLessonForMutationAsync(lessonOccurrenceId, locatorDate.Value, currentUser, dbContext, cancellationToken);
        if (target is null)
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var parsed = await ValidateLessonChangeRequestAsync(
            new ScheduleLessonChangePreviewRequest(
                request.Scope,
                request.NewLessonDate,
                request.StartTime,
                request.DurationMinutes,
                request.HallId,
                request.ExpectedRevision),
            target,
            dbContext,
            cancellationToken);
        if (parsed.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(parsed.Errors);
        }

        var hasAttendanceMarks = await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken);
        var currentLesson = MapResolvedMutationTarget(target, currentUser, attendanceDatePolicy, hasAttendanceMarks);
        if (!string.Equals(request.ExpectedRevision?.Trim(), currentLesson.Revision, StringComparison.Ordinal))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        if (parsed.Scope == "Occurrence" &&
            (target.Status == LessonOccurrenceStatus.Cancelled ||
                hasAttendanceMarks))
        {
            return CreateLessonMutationProblem("lesson-attendance-state-conflict", StatusCodes.Status409Conflict);
        }

        var hardConflict = await ValidateLessonChangeHardOverlapAsync(target, parsed, dbContext, cancellationToken);
        if (hardConflict is not null)
        {
            return hardConflict;
        }

        var warnings = await BuildLessonChangeWarningsAsync(target, parsed, dbContext, cancellationToken);
        var requestPayload = CreateChangePayload(target.OccurrenceId, locatorDate.Value, request.ExpectedRevision!, parsed, warnings);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(token.PayloadHash, requestPayload))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        if (parsed.Scope is "ThisAndFuture" or "EntireSeries")
        {
            return await ApplySeriesLessonChangeAsync(
                target,
                parsed,
                currentUser,
                attendanceDatePolicy,
                auditLogService,
                token,
                now,
                dbContext,
                cancellationToken);
        }

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
        if (target.Occurrence is null)
        {
            occurrence = new LessonOccurrence
            {
                Id = target.OccurrenceId,
                GroupId = target.Group.Id,
                LessonDate = parsed.NewLessonDate!.Value,
                StartTime = parsed.StartTime!.Value,
                DurationMinutes = parsed.DurationMinutes!.Value,
                HallId = parsed.Hall!.Id,
                SourceLessonSeriesId = target.Series?.Id,
                SourceRuleVersionId = target.RuleVersion?.Id,
                SourceSlotId = target.Slot?.Id,
                SourceSlotLineageId = target.Slot?.SlotLineageId,
                ProjectedDate = target.LessonDate,
                Status = LessonOccurrenceStatus.Scheduled,
                SourceKind = target.SourceKind,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.LessonOccurrences.Add(occurrence);
        }
        else
        {
            occurrence = target.Occurrence;
            occurrence.LessonDate = parsed.NewLessonDate!.Value;
            occurrence.StartTime = parsed.StartTime!.Value;
            occurrence.DurationMinutes = parsed.DurationMinutes!.Value;
            occurrence.HallId = parsed.Hall!.Id;
            occurrence.UpdatedAt = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "LessonOccurrenceChanged",
                "LessonOccurrence",
                occurrence.Id.ToString(),
                $"Пользователь '{currentUser.Login}' изменил занятие.",
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
            parsed.Hall,
            occurrence.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            new HashSet<Guid>(),
            $"{occurrence.Id:D}:{occurrence.Version}"));
    }

    private static async Task<Results<Ok<ScheduleGroupListResponse>, ValidationProblem, UnauthorizedHttpResult>> ListGroupsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IEffectiveGroupAssignmentService effectiveGroupAssignmentService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var errors = GroupRequestValidator.ValidatePaging(page, pageSize, skip, take);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = GroupRequestValidator.ResolvePaging(page, pageSize, skip, take);
        var query = TrainingGroupListQuery.CreateBaseQuery(dbContext);
        if (currentUser.Role == UserRole.Coach)
        {
            var effectiveGroupIds = await effectiveGroupAssignmentService
                .ListEffectiveAssignedGroupIdsAsync(currentUser.Id, cancellationToken);
            query = TrainingGroupListQuery.ApplyGroupIdScope(query, effectiveGroupIds);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var groups = await TrainingGroupListQuery.LoadPageAsync(query, paging, cancellationToken);

        IReadOnlyList<GroupListItemResponse> items = groups
            .Select(TrainingGroupListItemMapper.Map)
            .ToArray();

        return TypedResults.Ok(new ScheduleGroupListResponse(
            items,
            totalCount,
            paging.Skip,
            paging.Take));
    }

    internal static async Task<LegacyScheduleOccurrenceResolution?> ResolveLegacyProjectedOccurrenceAsync(
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        User currentUser,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var scopedSeries = await LoadScopedSeriesAsync(
            currentUser,
            lessonDate,
            lessonDate,
            dbContext,
            accessScopeService,
            cancellationToken);
        var resolved = ProjectLessons(
                scopedSeries,
                [],
                lessonDate,
                lessonDate,
                currentUser,
                new AttendanceDatePolicy(new FixedBusinessDateProvider(lessonDate)),
                new HashSet<Guid>())
            .SingleOrDefault(candidate => candidate.LessonOccurrenceId == lessonOccurrenceId);

        return resolved is null
            ? null
            : new LegacyScheduleOccurrenceResolution(
                resolved.GroupId,
                lessonDate,
                TimeOnly.ParseExact(resolved.StartTime, "HH\\:mm", CultureInfo.InvariantCulture),
                resolved.DurationMinutes);
    }

    private static async Task<List<LessonSeries>> LoadScopedSeriesAsync(
        User currentUser,
        DateOnly from,
        DateOnly to,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var accessScope = await accessScopeService.GetAccessScopeAsync(currentUser, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.LessonSeries
            .AsNoTracking()
            .Where(series =>
                series.StartsOn <= to &&
                (series.EndsOn == null || series.EndsOn >= from))
            .Include(series => series.Group)
                .ThenInclude(group => group.Branch)
            .Include(series => series.Group)
                .ThenInclude(group => group.GroupType)
            .Include(series => series.Group)
                .ThenInclude(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(series => accessibleGroupIds.Contains(series.GroupId));
        }

        return await query
            .OrderBy(series => series.Group.Name)
            .ThenBy(series => series.GroupId)
            .ToListAsync(cancellationToken);
    }

    private static async Task<HashSet<Guid>> LoadAttendanceMarkFactsAsync(
        GymCrmDbContext dbContext,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        return (await dbContext.Attendance
                .AsNoTracking()
                .Where(attendance => attendance.TrainingDate >= from && attendance.TrainingDate <= to)
                .Select(attendance => attendance.LessonOccurrenceId)
                .Distinct()
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private static async Task<IReadOnlyList<LessonOccurrence>> LoadMaterializedOccurrencesAsync(
        GymCrmDbContext dbContext,
        IReadOnlySet<Guid> groupIds,
        IReadOnlySet<Guid> substituteOccurrenceIds,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        if (groupIds.Count == 0 && substituteOccurrenceIds.Count == 0)
        {
            return [];
        }

        return await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                (groupIds.Contains(occurrence.GroupId) || substituteOccurrenceIds.Contains(occurrence.Id)) &&
                ((occurrence.LessonDate >= from && occurrence.LessonDate <= to) ||
                    (occurrence.ProjectedDate != null &&
                        occurrence.ProjectedDate >= from &&
                        occurrence.ProjectedDate <= to)))
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.Branch)
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.GroupType)
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.TrainerAssignments)
                    .ThenInclude(assignment => assignment.Trainer)
            .Include(occurrence => occurrence.Hall)
            .Include(occurrence => occurrence.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.ReplacedTrainer)
            .Include(occurrence => occurrence.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.SubstituteTrainer)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
    }

    private static async Task<HashSet<Guid>> LoadAccessibleSubstituteOccurrenceIdsAsync(
        GymCrmDbContext dbContext,
        User currentUser,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        if (currentUser.Role != UserRole.Coach)
        {
            return [];
        }

        return (await dbContext.LessonOccurrenceTrainerSubstitutions
                .AsNoTracking()
                .Where(substitution =>
                    substitution.SubstituteTrainerId == currentUser.Id &&
                    substitution.CancelledAt == null &&
                    substitution.LessonOccurrence.LessonDate >= from &&
                    substitution.LessonOccurrence.LessonDate <= to)
                .Select(substitution => substitution.LessonOccurrenceId)
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private static IEnumerable<ScheduleLessonResponse> ProjectLessons(
        IEnumerable<LessonSeries> series,
        IReadOnlyList<LessonOccurrence> materialized,
        DateOnly from,
        DateOnly to,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks)
    {
        var materializedById = materialized.ToDictionary(occurrence => occurrence.Id);
        var yieldedIds = new HashSet<Guid>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var weekday = ToIsoWeekday(date);
            foreach (var candidate in series)
            {
                if (date < candidate.StartsOn || (candidate.EndsOn is not null && date > candidate.EndsOn.Value))
                {
                    continue;
                }

                foreach (var version in candidate.RuleVersions
                    .Where(version =>
                        version.EffectiveFrom <= date &&
                        (version.EffectiveTo is null || version.EffectiveTo >= date))
                    .OrderBy(version => version.VersionNumber))
                {
                    foreach (var slot in version.Slots
                        .Where(slot => slot.IsoWeekday == weekday)
                        .OrderBy(slot => slot.StartTime)
                        .ThenBy(slot => slot.Id))
                    {
                        var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, date);
                        if (materializedById.TryGetValue(occurrenceId, out var occurrence))
                        {
                            if (occurrence.LessonDate == date)
                            {
                                var materializedLesson = MapMaterializedLesson(
                                    occurrence,
                                    currentUser,
                                    attendanceDatePolicy,
                                    attendanceMarks);
                                yieldedIds.Add(materializedLesson.LessonOccurrenceId);
                                yield return materializedLesson;
                            }

                            continue;
                        }

                        var lesson = MapLesson(
                                candidate,
                                version,
                                slot,
                                date,
                                currentUser,
                                attendanceDatePolicy,
                                attendanceMarks);
                        yieldedIds.Add(lesson.LessonOccurrenceId);
                        yield return lesson;
                    }
                }
            }
        }

        foreach (var occurrence in materialized
            .Where(occurrence =>
                !yieldedIds.Contains(occurrence.Id) &&
                occurrence.LessonDate >= from &&
                occurrence.LessonDate <= to)
            .OrderBy(occurrence => occurrence.LessonDate)
            .ThenBy(occurrence => occurrence.StartTime)
            .ThenBy(occurrence => occurrence.Id))
        {
            yieldedIds.Add(occurrence.Id);
            yield return MapMaterializedLesson(occurrence, currentUser, attendanceDatePolicy, attendanceMarks);
        }
    }

    private static ScheduleLessonResponse MapMaterializedLesson(
        LessonOccurrence occurrence,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks)
    {
        return MapLesson(
            occurrence.Id,
            occurrence.SourceKind.ToString(),
            true,
            occurrence.SourceLessonSeriesId,
            occurrence.LessonDate,
            occurrence.StartTime,
            occurrence.DurationMinutes,
            occurrence.Group,
            occurrence.Hall,
            occurrence.Status.ToString(),
            currentUser,
            attendanceDatePolicy,
            attendanceMarks,
            $"{occurrence.Id:D}:{occurrence.Version}",
            occurrence.TrainerSubstitutions);
    }

    private static ScheduleLessonResponse MapLesson(
        Guid occurrenceId,
        string sourceKind,
        bool isMaterialized,
        Guid? lessonSeriesId,
        DateOnly lessonDate,
        TimeOnly startTime,
        int durationMinutes,
        GymCrm.Domain.Groups.TrainingGroup group,
        GymCrm.Domain.Branches.Hall hall,
        string status,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks,
        string sourceRevision,
        IEnumerable<LessonOccurrenceTrainerSubstitution>? substitutions = null)
    {
        var effectiveTrainers = MapEffectiveTrainers(group, lessonDate, substitutions ?? []);
        var isManagement = currentUser.Role is UserRole.Administrator or UserRole.HeadCoach or UserRole.SuperAdministrator;
        var canEditAttendance = status == "Scheduled" && attendanceDatePolicy.IsAllowed(currentUser.Role, lessonDate);
        var allowedActions = new ScheduleLessonAllowedActionsResponse(
            new ScheduleActionResponse(true, null),
            new ScheduleActionResponse(canEditAttendance, canEditAttendance ? null : "attendance-date-unavailable"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled",
                !isManagement ? "role-not-allowed" : status == "Scheduled" ? null : "lesson-not-scheduled"),
            new ScheduleActionResponse(
                isManagement && status == "Cancelled",
                !isManagement ? "role-not-allowed" : status == "Cancelled" ? null : "lesson-not-cancelled"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled",
                !isManagement ? "role-not-allowed" : status == "Scheduled" ? null : "lesson-not-scheduled"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled" && effectiveTrainers.Any(trainer => trainer.Kind == "Substitute"),
                !isManagement
                    ? "role-not-allowed"
                    : status != "Scheduled"
                        ? "lesson-not-scheduled"
                        : effectiveTrainers.Any(trainer => trainer.Kind == "Substitute")
                            ? null
                            : "no-active-substitution"));
        var hasAttendanceMarks = attendanceMarks.Contains(occurrenceId);
        var endTime = startTime.AddMinutes(durationMinutes);

        return new ScheduleLessonResponse(
            occurrenceId,
            sourceKind,
            isMaterialized,
            lessonSeriesId,
            lessonDate,
            startTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            durationMinutes,
            endTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            group.Id,
            group.Name,
            group.GroupTypeId,
            group.GroupType.Name,
            group.BranchId,
            group.Branch.Name,
            hall.Id,
            hall.Name,
            effectiveTrainers,
            status,
            hasAttendanceMarks,
            allowedActions,
            BuildRevision(
                occurrenceId,
                group.Id,
                lessonDate,
                startTime,
                durationMinutes,
                hall.Id,
                effectiveTrainers,
                status,
                hasAttendanceMarks,
                sourceRevision));
    }

    private static ScheduleLessonResponse MapLesson(
        LessonSeries series,
        LessonScheduleRuleVersion version,
        LessonScheduleSlot slot,
        DateOnly lessonDate,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        IReadOnlySet<Guid> attendanceMarks)
    {
        var group = series.Group;
        var startTime = slot.StartTime;
        var durationMinutes = slot.DurationMinutes;
        var endTime = startTime.AddMinutes(durationMinutes);
        var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, lessonDate);
        var effectiveTrainers = MapEffectiveTrainers(group, lessonDate, []);
        var isManagement = currentUser.Role is UserRole.Administrator or UserRole.HeadCoach or UserRole.SuperAdministrator;
        var canEditAttendance = attendanceDatePolicy.IsAllowed(currentUser.Role, lessonDate);
        var allowedActions = new ScheduleLessonAllowedActionsResponse(
            new ScheduleActionResponse(true, null),
            new ScheduleActionResponse(canEditAttendance, canEditAttendance ? null : "attendance-date-unavailable"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(false, "lesson-not-cancelled"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(false, "no-active-substitution"));
        var hasAttendanceMarks = attendanceMarks.Contains(occurrenceId);

        return new ScheduleLessonResponse(
            occurrenceId,
            "Recurring",
            false,
            series.Id,
            lessonDate,
            startTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            durationMinutes,
            endTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            group.Id,
            group.Name,
            group.GroupTypeId,
            group.GroupType.Name,
            group.BranchId,
            group.Branch.Name,
            slot.HallId,
            slot.Hall.Name,
            effectiveTrainers,
            "Scheduled",
            hasAttendanceMarks,
            allowedActions,
            BuildRevision(
                occurrenceId,
                group.Id,
                lessonDate,
                startTime,
                durationMinutes,
                slot.HallId,
                effectiveTrainers,
                "Scheduled",
                hasAttendanceMarks,
                $"{series.Id:D}:{version.Id:D}:{slot.Id:D}:{slot.SlotLineageId:D}"));
    }

    private static IReadOnlyList<ScheduleLessonTrainerResponse> MapEffectiveTrainers(
        GymCrm.Domain.Groups.TrainingGroup group,
        DateOnly lessonDate,
        IEnumerable<LessonOccurrenceTrainerSubstitution> substitutions)
    {
        var activeSubstitutions = substitutions
            .Where(substitution => substitution.CancelledAt == null)
            .GroupBy(substitution => substitution.ReplacedTrainerId)
            .Select(grouping => grouping.OrderBy(substitution => substitution.CreatedAt).ThenBy(substitution => substitution.Id).First())
            .ToDictionary(substitution => substitution.ReplacedTrainerId);

        var permanent = group.TrainerAssignments
            .Where(assignment =>
                assignment.ValidFrom <= lessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= lessonDate) &&
                !activeSubstitutions.ContainsKey(assignment.TrainerId))
            .Select(assignment => new ScheduleLessonTrainerResponse(
                assignment.TrainerId,
                assignment.Trainer.FullName,
                "Permanent",
                null,
                null));
        var substitute = activeSubstitutions.Values
            .Select(substitution => new ScheduleLessonTrainerResponse(
                substitution.SubstituteTrainerId,
                substitution.SubstituteTrainer.FullName,
                "Substitute",
                substitution.ReplacedTrainerId,
                substitution.Id));

        return permanent
            .Concat(substitute)
            .OrderBy(trainer => trainer.FullName)
            .ThenBy(trainer => trainer.TrainerId)
            .ToArray();
    }

    private static ScheduleCapabilitiesResponse BuildCapabilities(User currentUser)
    {
        var isManagement = currentUser.Role is UserRole.Administrator or UserRole.HeadCoach or UserRole.SuperAdministrator;
        return new ScheduleCapabilitiesResponse(
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"));
    }

    private static ScheduleActionResponse ScheduleMutationUnavailableAction()
    {
        return new ScheduleActionResponse(false, "schedule-mutations-unavailable");
    }

    private static ScheduleFilterOptionsResponse BuildFilterOptions(
        IReadOnlyCollection<LessonSeries> series)
    {
        return new ScheduleFilterOptionsResponse(
            series
                .GroupBy(item => new { item.Group.BranchId, item.Group.Branch.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOptionResponse(group.Key.BranchId, group.Key.Name))
                .ToArray(),
            series
                .SelectMany(item => item.RuleVersions.SelectMany(version => version.Slots))
                .GroupBy(slot => new { slot.HallId, slot.Hall.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOptionResponse(group.Key.HallId, group.Key.Name))
                .ToArray(),
            series
                .SelectMany(item => item.Group.TrainerAssignments)
                .GroupBy(assignment => new { Id = assignment.TrainerId, Name = assignment.Trainer.FullName })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOptionResponse(group.Key.Id, group.Key.Name))
                .ToArray(),
            series
                .OrderBy(item => item.Group.Name)
                .ThenBy(item => item.GroupId)
                .Select(item => new ScheduleFilterOptionResponse(item.GroupId, item.Group.Name))
                .ToArray(),
            series
                .GroupBy(item => new { item.Group.GroupTypeId, item.Group.GroupType.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOptionResponse(group.Key.GroupTypeId, group.Key.Name))
                .ToArray());
    }

    private static string BuildRevision(
        Guid occurrenceId,
        Guid groupId,
        DateOnly lessonDate,
        TimeOnly startTime,
        int durationMinutes,
        Guid hallId,
        IReadOnlyList<ScheduleLessonTrainerResponse> effectiveTrainers,
        string status,
        bool hasAttendanceMarks,
        string sourceRevision)
    {
        var canonical = string.Join(
            "|",
            occurrenceId.ToString("D"),
            groupId.ToString("D"),
            lessonDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            startTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            durationMinutes.ToString(CultureInfo.InvariantCulture),
            hallId.ToString("D"),
            string.Join(",", effectiveTrainers
                .Select(trainer => string.Join(
                    ":",
                    trainer.TrainerId.ToString("D"),
                    trainer.Kind,
                    trainer.ReplacedTrainerId?.ToString("D") ?? string.Empty,
                    trainer.SubstitutionId?.ToString("D") ?? string.Empty))
                .Order(StringComparer.Ordinal)),
            status,
            hasAttendanceMarks ? "marks" : "no-marks",
            sourceRevision);

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return Convert.ToBase64String(hash)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static (DateOnly From, DateOnly To)? ParseRange(string? from, string? to)
    {
        var parsedFrom = ParseDate(from);
        var parsedTo = ParseDate(to);
        if (!parsedFrom.HasValue || !parsedTo.HasValue || parsedFrom.Value > parsedTo.Value)
        {
            return null;
        }

        var days = parsedTo.Value.DayNumber - parsedFrom.Value.DayNumber + 1;
        return days > MaxCalendarRangeDays
            ? null
            : (parsedFrom.Value, parsedTo.Value);
    }

    private static DateOnly? ParseDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            LessonDateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private static ValidationProblem CreateCalendarRangeValidationProblem()
    {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["from"] = [$"Диапазон расписания должен использовать {LessonDateFormat}, from <= to и не больше {MaxCalendarRangeDays} дней."],
            ["to"] = [$"Диапазон расписания должен использовать {LessonDateFormat}, from <= to и не больше {MaxCalendarRangeDays} дней."]
        });
    }

    private static ProblemHttpResult CreateOccurrenceNotFoundProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/lesson-occurrence-not-found",
            Title = "Lesson occurrence was not found for the supplied date locator.",
            Status = StatusCodes.Status404NotFound,
            Extensions =
            {
                ["code"] = "lesson-occurrence-not-found"
            }
        });
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }

    private sealed record OneOffLessonRequestValidation(
        Dictionary<string, string[]> Errors,
        TrainingGroup? Group,
        Hall? Hall,
        DateOnly? LessonDate,
        TimeOnly? StartTime,
        int? DurationMinutes)
    {
        public bool Forbidden { get; init; }
    }

    private sealed record LessonChangeRequestValidation(
        Dictionary<string, string[]> Errors,
        string Scope,
        Hall? Hall,
        DateOnly? NewLessonDate,
        TimeOnly? StartTime,
        int? DurationMinutes);

    private sealed record ResolvedLessonMutationTarget(
        LessonOccurrence? Occurrence,
        Guid OccurrenceId,
        LessonSeries? Series,
        LessonScheduleRuleVersion? RuleVersion,
        LessonScheduleSlot? Slot,
        TrainingGroup Group,
        Hall Hall,
        DateOnly LessonDate,
        TimeOnly StartTime,
        int DurationMinutes,
        LessonOccurrenceStatus Status,
        LessonOccurrenceSourceKind SourceKind);
}

internal sealed record LegacyScheduleOccurrenceResolution(
    Guid GroupId,
    DateOnly LessonDate,
    TimeOnly StartTime,
    int DurationMinutes,
    bool IsOccurrenceScopedAccess = false);
