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
using GymCrm.Infrastructure.Authorization;
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
        IScheduleLessonReader lessonReader,
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

        var read = await lessonReader.ReadAsync(currentUser,
            new ScheduleReadQuery(range.Value.From, range.Value.To, branchId, hallId, groupId, groupTypeId),
            cancellationToken);
        var items = read.Lessons.Select(lesson => MapLesson(lesson, currentUser))
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
            MapFilterOptions(read.FilterOptions)));
    }

    private static async Task<Results<Ok<ScheduleLessonResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> GetLessonAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        HttpContext httpContext,
        IScheduleLessonReader lessonReader,
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
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine16828ddd147(LessonDateFormat)]
            });
        }

        var read = await lessonReader.ReadAsync(currentUser,
            new ScheduleReadQuery(parsedDate.Value, parsedDate.Value), cancellationToken);
        var facts = read.Lessons.SingleOrDefault(candidate => candidate.LessonOccurrenceId == lessonOccurrenceId);
        var lesson = facts is null ? null : MapLesson(facts, currentUser);

        return lesson is null
            ? CreateOccurrenceNotFoundProblem()
            : TypedResults.Ok(lesson);
    }

    internal static async Task<IReadOnlyList<ScheduleLessonResponse>> LoadScopedLessonsAsync(
        User currentUser,
        DateOnly from,
        DateOnly to,
        IScheduleLessonReader lessonReader,
        CancellationToken cancellationToken)
    {
        var read = await lessonReader.ReadAsync(currentUser, new ScheduleReadQuery(from, to), cancellationToken);
        return read.Lessons.Select(lesson => MapLesson(lesson, currentUser)).ToArray();
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
                global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine500Ee8753d1(currentUser.Login),
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
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine78328ddd147(LessonDateFormat)]
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
                errors["action"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine7995ae8af84];
            }

            if (string.IsNullOrWhiteSpace(request.ExpectedRevision))
            {
                errors["expectedRevision"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine804F663a580];
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
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine89028ddd147(LessonDateFormat)]
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
                errors["action"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine9195ae8af84];
            }

            if (string.IsNullOrWhiteSpace(request.ExpectedRevision))
            {
                errors["expectedRevision"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine924F663a580];
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
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine100228ddd147(LessonDateFormat)]
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
                ["lessonDate"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine112528ddd147(LessonDateFormat)]
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
                global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine1267D2280944(currentUser.Login),
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
        await using var actorLease = await ClientAccessTransaction.BeginReadAsync(dbContext, currentUser.Id, [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null) return TypedResults.Unauthorized();


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
        var groups = await TrainingGroupListQuery.LoadPageAsync(query, paging, cancellationToken, dbContext, currentUser);

        IReadOnlyList<GroupListItemResponse> items = groups
            .Select(group => TrainingGroupListItemMapper.Map(group, currentUser))
            .ToArray();

        return TypedResults.Ok(new ScheduleGroupListResponse(
            items,
            totalCount,
            paging.Skip,
            paging.Take));
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
        return MapLesson(ScheduleLessonProjector.Create(
            occurrenceId, Enum.Parse<LessonOccurrenceSourceKind>(sourceKind), isMaterialized, lessonSeriesId,
            lessonDate, startTime, durationMinutes, group, hall, Enum.Parse<LessonOccurrenceStatus>(status),
            currentUser.Role, attendanceDatePolicy, attendanceMarks, sourceRevision, substitutions), currentUser, recurringProjection: false);
    }

    private static ScheduleLessonResponse MapLesson(ScheduleLessonFacts lesson, User currentUser, bool recurringProjection = true)
    {
        var effectiveTrainers = lesson.EffectiveTrainers.Select(trainer => new ScheduleLessonTrainerResponse(
            trainer.TrainerId, trainer.FullName, trainer.Kind.ToString(), trainer.ReplacedTrainerId, trainer.SubstitutionId)).ToArray();
        var status = lesson.Status.ToString();
        var isManagement = currentUser.Role is UserRole.Administrator or UserRole.HeadCoach or UserRole.SuperAdministrator;
        var canEditAttendance = lesson.CanEditAttendance;
        var allowedActions = new ScheduleLessonAllowedActionsResponse(
            new ScheduleActionResponse(lesson.CanViewAttendance, null),
            new ScheduleActionResponse(canEditAttendance, canEditAttendance ? null : "attendance-date-unavailable"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled",
                !isManagement ? "role-not-allowed" : status == "Scheduled" ? null : "lesson-not-scheduled"),
            new ScheduleActionResponse(
                isManagement && status == "Cancelled",
                recurringProjection && !lesson.IsMaterialized && lesson.SourceKind == LessonOccurrenceSourceKind.Recurring
                    ? "lesson-not-cancelled"
                    : !isManagement ? "role-not-allowed" : status == "Cancelled" ? null : "lesson-not-cancelled"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled",
                !isManagement ? "role-not-allowed" : status == "Scheduled" ? null : "lesson-not-scheduled"),
            new ScheduleActionResponse(
                isManagement && status == "Scheduled" && effectiveTrainers.Any(trainer => trainer.Kind == "Substitute"),
                recurringProjection && !lesson.IsMaterialized && lesson.SourceKind == LessonOccurrenceSourceKind.Recurring
                    ? "no-active-substitution"
                    : !isManagement
                    ? "role-not-allowed"
                    : status != "Scheduled"
                        ? "lesson-not-scheduled"
                        : effectiveTrainers.Any(trainer => trainer.Kind == "Substitute")
                            ? null
                            : "no-active-substitution"));
        var hasAttendanceMarks = lesson.HasAttendanceMarks;
        var endTime = lesson.StartTime.AddMinutes(lesson.DurationMinutes);

        return new ScheduleLessonResponse(
            lesson.LessonOccurrenceId,
            lesson.SourceKind.ToString(),
            lesson.IsMaterialized,
            lesson.LessonSeriesId,
            lesson.LessonDate,
            lesson.StartTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            lesson.DurationMinutes,
            endTime.ToString("HH\\:mm", CultureInfo.InvariantCulture),
            lesson.GroupId,
            lesson.GroupName,
            lesson.GroupTypeId,
            lesson.GroupTypeName,
            lesson.BranchId,
            lesson.BranchName,
            lesson.HallId,
            lesson.HallName,
            effectiveTrainers,
            status,
            hasAttendanceMarks,
            allowedActions,
            BuildRevision(
                lesson.LessonOccurrenceId,
                lesson.GroupId,
                lesson.LessonDate,
                lesson.StartTime,
                lesson.DurationMinutes,
                lesson.HallId,
                effectiveTrainers,
                status,
                hasAttendanceMarks,
                lesson.SourceRevision));
    }

    private static ScheduleCapabilitiesResponse BuildCapabilities(User currentUser)
    {
        var isManagement = currentUser.Role is UserRole.Administrator or UserRole.HeadCoach or UserRole.SuperAdministrator;
        return new ScheduleCapabilitiesResponse(
            new ScheduleActionResponse(isManagement, isManagement ? null : "role-not-allowed"));
    }

    private static ScheduleFilterOptionsResponse MapFilterOptions(ScheduleFilterOptions options) => new(
        options.Branches.Select(MapFilterOption).ToArray(),
        options.Halls.Select(MapFilterOption).ToArray(),
        options.Trainers.Select(MapFilterOption).ToArray(),
        options.Groups.Select(MapFilterOption).ToArray(),
        options.GroupTypes.Select(MapFilterOption).ToArray());

    private static ScheduleFilterOptionResponse MapFilterOption(ScheduleFilterOption option) => new(option.Id, option.Name);

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
            ["from"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine18883aaab2cd(LessonDateFormat, MaxCalendarRangeDays)],
            ["to"] = [global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine18893aaab2cd(LessonDateFormat, MaxCalendarRangeDays)]
        });
    }

    private static ProblemHttpResult CreateOccurrenceNotFoundProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/lesson-occurrence-not-found",
            Title = global::GymCrm.Api.UserFacingText.BE6ScheduleText.ScheduleEndpointsLine1898A0d4e31f,
            Status = StatusCodes.Status404NotFound,
            Extensions =
            {
                ["code"] = "lesson-occurrence-not-found"
            }
        });
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
