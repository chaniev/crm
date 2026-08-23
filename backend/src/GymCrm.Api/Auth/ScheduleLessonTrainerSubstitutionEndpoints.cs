using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static partial class ScheduleEndpoints
{
    private static async Task<IResult> PreviewLessonTrainerSubstitutionsAsync(
        ScheduleLessonTrainerSubstitutionPreviewRequest request,
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

        var validation = await ValidateTrainerSubstitutionRequestAsync(
            request.ReplacedTrainerId,
            request.SubstituteTrainerId,
            request.Targets,
            currentUser,
            dbContext,
            attendanceDatePolicy,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var payload = CreateTrainerSubstitutionPayload(
            validation.ReplacedTrainerId,
            validation.SubstituteTrainerId,
            validation.Targets,
            validation.Warnings);
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var rawToken = ScheduleMutationTokenPolicy.CreateSecureToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(ScheduleMutationTokenPolicy.ConfirmationTokenLifetime);
        dbContext.ScheduleMutationConfirmationTokens.Add(new ScheduleMutationConfirmationToken
        {
            Id = Guid.NewGuid(),
            TokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken),
            ActorUserId = currentUser.Id,
            Purpose = ScheduleMutationTokenPolicy.LessonTrainerSubstitutionPurpose,
            PayloadHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson),
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new ScheduleLessonTrainerSubstitutionPreviewResponse(
            rawToken,
            expiresAt,
            validation.Targets.Select(target => new ScheduleLessonTrainerSubstitutionTargetResponse(
                target.Target.OccurrenceId,
                target.Target.LessonDate,
                target.Target.Group.Id,
                target.Target.Group.Name,
                null,
                target.Warnings)).ToArray(),
            validation.Warnings));
    }

    private static async Task<IResult> ApplyLessonTrainerSubstitutionsAsync(
        ScheduleLessonTrainerSubstitutionExecuteRequest request,
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

        var tokenResult = await LoadScheduleMutationTokenAsync(
            request.ConfirmationToken,
            currentUser.Id,
            ScheduleMutationTokenPolicy.LessonTrainerSubstitutionPurpose,
            dbContext,
            cancellationToken);
        if (tokenResult.Result is not null)
        {
            return tokenResult.Result;
        }

        var validation = await ValidateTrainerSubstitutionRequestAsync(
            request.ReplacedTrainerId,
            request.SubstituteTrainerId,
            request.Targets,
            currentUser,
            dbContext,
            attendanceDatePolicy,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var requestPayload = CreateTrainerSubstitutionPayload(
            validation.ReplacedTrainerId,
            validation.SubstituteTrainerId,
            validation.Targets,
            validation.Warnings);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(tokenResult.Token!.PayloadHash, requestPayload))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
            dbContext,
            tokenResult.Token!,
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

        var lessons = new List<ScheduleLessonResponse>();
        foreach (var target in validation.Targets)
        {
            var occurrence = await MaterializeSubstitutionTargetAsync(target.Target, now, dbContext, cancellationToken);
            var existing = await dbContext.LessonOccurrenceTrainerSubstitutions
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.Group)
                        .ThenInclude(group => group.Branch)
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.Group)
                        .ThenInclude(group => group.GroupType)
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.Group)
                        .ThenInclude(group => group.TrainerAssignments)
                            .ThenInclude(assignment => assignment.Trainer)
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.Hall)
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.TrainerSubstitutions.Where(item => item.CancelledAt == null))
                        .ThenInclude(item => item.ReplacedTrainer)
                .Include(substitution => substitution.LessonOccurrence)
                    .ThenInclude(occurrence => occurrence.TrainerSubstitutions.Where(item => item.CancelledAt == null))
                        .ThenInclude(item => item.SubstituteTrainer)
                .SingleOrDefaultAsync(substitution =>
                    substitution.LessonOccurrenceId == occurrence.Id &&
                    substitution.ReplacedTrainerId == validation.ReplacedTrainerId &&
                    substitution.CancelledAt == null,
                    cancellationToken);
            if (existing is not null)
            {
                if (existing.SubstituteTrainerId != validation.SubstituteTrainerId)
                {
                    return CreateLessonMutationProblem("lesson-trainer-substitution-conflict", StatusCodes.Status409Conflict);
                }

                lessons.Add(MapMaterializedLesson(
                    existing.LessonOccurrence,
                    currentUser,
                    attendanceDatePolicy,
                    new HashSet<Guid>()));
                continue;
            }

            var substitution = new LessonOccurrenceTrainerSubstitution
            {
                Id = Guid.NewGuid(),
                LessonOccurrenceId = occurrence.Id,
                ReplacedTrainerId = validation.ReplacedTrainerId,
                SubstituteTrainerId = validation.SubstituteTrainerId,
                CreatedByUserId = currentUser.Id,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.LessonOccurrenceTrainerSubstitutions.Add(substitution);
            occurrence.UpdatedAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    "LessonOccurrenceTrainerSubstitutionCreated",
                    "LessonOccurrenceTrainerSubstitution",
                    substitution.Id.ToString(),
                    $"Пользователь '{currentUser.Login}' назначил замену тренера на занятие.",
                    NewValueJson: JsonSerializer.Serialize(new
                    {
                        substitution.Id,
                        substitution.LessonOccurrenceId,
                        substitution.ReplacedTrainerId,
                        substitution.SubstituteTrainerId
                    }, JsonOptions)),
                cancellationToken);

            lessons.Add(await LoadMaterializedLessonAsync(
                occurrence.Id,
                currentUser,
                attendanceDatePolicy,
                dbContext,
                cancellationToken));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return TypedResults.Ok(new ScheduleLessonTrainerSubstitutionExecuteResponse(
            lessons,
            validation.Warnings));
    }

    private static async Task<IResult> PreviewLessonTrainerSubstitutionCancellationsAsync(
        ScheduleLessonTrainerSubstitutionCancellationPreviewRequest request,
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

        var validation = await ValidateTrainerSubstitutionCancellationRequestAsync(
            request.Targets,
            currentUser,
            dbContext,
            attendanceDatePolicy,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var payload = CreateTrainerSubstitutionCancellationPayload(validation.Targets, request.Reason, validation.Warnings);
        var payloadJson = ScheduleMutationTokenPolicy.SerializePayload(payload);
        var rawToken = ScheduleMutationTokenPolicy.CreateSecureToken();
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(ScheduleMutationTokenPolicy.ConfirmationTokenLifetime);
        dbContext.ScheduleMutationConfirmationTokens.Add(new ScheduleMutationConfirmationToken
        {
            Id = Guid.NewGuid(),
            TokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken),
            ActorUserId = currentUser.Id,
            Purpose = ScheduleMutationTokenPolicy.LessonTrainerSubstitutionCancellationPurpose,
            PayloadHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(payloadJson),
            PayloadJson = payloadJson,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new ScheduleLessonTrainerSubstitutionCancellationPreviewResponse(
            rawToken,
            expiresAt,
            validation.Targets.Select(target => new ScheduleLessonTrainerSubstitutionTargetResponse(
                target.Target.OccurrenceId,
                target.Target.LessonDate,
                target.Target.Group.Id,
                target.Target.Group.Name,
                target.Substitution.Id,
                target.Warnings)).ToArray(),
            validation.Warnings));
    }

    private static async Task<IResult> ApplyLessonTrainerSubstitutionCancellationsAsync(
        ScheduleLessonTrainerSubstitutionCancellationExecuteRequest request,
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

        var tokenResult = await LoadScheduleMutationTokenAsync(
            request.ConfirmationToken,
            currentUser.Id,
            ScheduleMutationTokenPolicy.LessonTrainerSubstitutionCancellationPurpose,
            dbContext,
            cancellationToken);
        if (tokenResult.Result is not null)
        {
            return tokenResult.Result;
        }

        var validation = await ValidateTrainerSubstitutionCancellationRequestAsync(
            request.Targets,
            currentUser,
            dbContext,
            attendanceDatePolicy,
            cancellationToken);
        if (validation.Result is not null)
        {
            return validation.Result;
        }

        var requestPayload = CreateTrainerSubstitutionCancellationPayload(validation.Targets, request.Reason, validation.Warnings);
        if (!ScheduleMutationTokenPolicy.PayloadMatches(tokenResult.Token!.PayloadHash, requestPayload))
        {
            return CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict);
        }

        var now = DateTimeOffset.UtcNow;
        await using var transaction = await BeginTransactionIfSupportedAsync(dbContext, cancellationToken);
        var tokenClaim = await ScheduleMutationTokenClaimPolicy.ClaimAsync(
            dbContext,
            tokenResult.Token!,
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

        foreach (var item in validation.Targets)
        {
            item.Substitution.CancelledAt = now;
            item.Substitution.CancelledByUserId = currentUser.Id;
            item.Substitution.CancellationReason = NormalizeCancellationReason(request.Reason);
            item.Substitution.UpdatedAt = now;
            item.Substitution.UpdatedByUserId = currentUser.Id;
            item.Target.Occurrence!.UpdatedAt = now;
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    "LessonOccurrenceTrainerSubstitutionCancelled",
                    "LessonOccurrenceTrainerSubstitution",
                    item.Substitution.Id.ToString(),
                    $"Пользователь '{currentUser.Login}' отменил замену тренера на занятие.",
                    OldValueJson: JsonSerializer.Serialize(new
                    {
                        item.Substitution.Id,
                        item.Substitution.LessonOccurrenceId,
                        item.Substitution.ReplacedTrainerId,
                        item.Substitution.SubstituteTrainerId
                    }, JsonOptions),
                    NewValueJson: JsonSerializer.Serialize(new
                    {
                        item.Substitution.Id,
                        item.Substitution.LessonOccurrenceId,
                        CancelledAt = now,
                        CancelledByUserId = currentUser.Id,
                        Reason = NormalizeCancellationReason(request.Reason)
                    }, JsonOptions)),
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var lessons = new List<ScheduleLessonResponse>();
        foreach (var item in validation.Targets)
        {
            lessons.Add(await LoadMaterializedLessonAsync(
                item.Target.OccurrenceId,
                currentUser,
                attendanceDatePolicy,
                dbContext,
                cancellationToken));
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return TypedResults.Ok(new ScheduleLessonTrainerSubstitutionCancellationExecuteResponse(
            lessons,
            validation.Warnings));
    }

    private static async Task<TrainerSubstitutionValidation> ValidateTrainerSubstitutionRequestAsync(
        Guid? replacedTrainerId,
        Guid? substituteTrainerId,
        IReadOnlyList<ScheduleLessonTrainerSubstitutionTargetRequest>? targets,
        User currentUser,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (!replacedTrainerId.HasValue || replacedTrainerId == Guid.Empty)
        {
            errors["replacedTrainerId"] = ["Заменяемый тренер обязателен."];
        }

        if (!substituteTrainerId.HasValue || substituteTrainerId == Guid.Empty)
        {
            errors["substituteTrainerId"] = ["Замещающий тренер обязателен."];
        }

        if (replacedTrainerId.HasValue && substituteTrainerId.HasValue && replacedTrainerId.Value == substituteTrainerId.Value)
        {
            errors["substituteTrainerId"] = ["Замещающий тренер должен отличаться от заменяемого."];
        }

        if (targets is null || targets.Count == 0)
        {
            errors["targets"] = ["Передайте хотя бы одно занятие."];
        }

        if (errors.Count > 0)
        {
            return TrainerSubstitutionValidation.Failure(TypedResults.ValidationProblem(errors));
        }

        var substitute = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Id == substituteTrainerId!.Value, cancellationToken);
        if (substitute is null || !substitute.IsActive || substitute.Role is not (UserRole.Coach or UserRole.HeadCoach))
        {
            return TrainerSubstitutionValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["substituteTrainerId"] = ["Замещающий тренер не найден или неактивен."]
            }));
        }

        var validatedTargets = new List<ValidatedTrainerSubstitutionTarget>();
        var allWarnings = new List<ScheduleWarningResponse>();
        foreach (var requestTarget in targets!)
        {
            if (!requestTarget.LessonOccurrenceId.HasValue || string.IsNullOrWhiteSpace(requestTarget.ExpectedRevision))
            {
                return TrainerSubstitutionValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["targets"] = ["Каждая цель должна содержать lessonOccurrenceId и expectedRevision."]
                }));
            }

            var lessonDate = ParseDate(requestTarget.LessonDate);
            if (!lessonDate.HasValue)
            {
                return TrainerSubstitutionValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["targets.lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
                }));
            }

            var target = await ResolveLessonForMutationAsync(
                requestTarget.LessonOccurrenceId.Value,
                lessonDate.Value,
                currentUser,
                dbContext,
                cancellationToken);
            if (target is null)
            {
                return TrainerSubstitutionValidation.Failure(CreateOccurrenceNotFoundProblem());
            }

            var currentLesson = MapResolvedMutationTarget(
                target,
                currentUser,
                attendanceDatePolicy,
                await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken));
            if (!string.Equals(requestTarget.ExpectedRevision!.Trim(), currentLesson.Revision, StringComparison.Ordinal))
            {
                return TrainerSubstitutionValidation.Failure(CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict));
            }

            if (target.Status != LessonOccurrenceStatus.Scheduled)
            {
                return TrainerSubstitutionValidation.Failure(CreateLessonMutationProblem("lesson-not-scheduled", StatusCodes.Status409Conflict));
            }

            var isPermanent = target.Group.TrainerAssignments.Any(assignment =>
                assignment.TrainerId == replacedTrainerId!.Value &&
                assignment.ValidFrom <= target.LessonDate &&
                (assignment.ValidTo is null || assignment.ValidTo >= target.LessonDate));
            if (!isPermanent)
            {
                return TrainerSubstitutionValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["replacedTrainerId"] = ["Заменяемый тренер не является постоянным тренером группы на дату занятия."]
                }));
            }

            var activeConflict = target.Occurrence is null
                ? false
                : await dbContext.LessonOccurrenceTrainerSubstitutions
                    .AsNoTracking()
                    .AnyAsync(substitution =>
                        substitution.LessonOccurrenceId == target.OccurrenceId &&
                        substitution.ReplacedTrainerId == replacedTrainerId!.Value &&
                        substitution.CancelledAt == null &&
                        substitution.SubstituteTrainerId != substituteTrainerId!.Value,
                        cancellationToken);
            if (activeConflict)
            {
                return TrainerSubstitutionValidation.Failure(CreateLessonMutationProblem("lesson-trainer-substitution-conflict", StatusCodes.Status409Conflict));
            }

            var warnings = await BuildTrainerSubstitutionWarningsAsync(
                target,
                substituteTrainerId!.Value,
                dbContext,
                cancellationToken);
            validatedTargets.Add(new ValidatedTrainerSubstitutionTarget(target, requestTarget.ExpectedRevision.Trim(), warnings));
            allWarnings.AddRange(warnings);
        }

        return new TrainerSubstitutionValidation(
            null,
            replacedTrainerId!.Value,
            substituteTrainerId!.Value,
            validatedTargets,
            allWarnings
                .GroupBy(warning => warning.Code, StringComparer.Ordinal)
                .Select(group => group.First())
                .OrderBy(warning => warning.Code, StringComparer.Ordinal)
                .ToArray());
    }

    private static async Task<TrainerSubstitutionCancellationValidation> ValidateTrainerSubstitutionCancellationRequestAsync(
        IReadOnlyList<ScheduleLessonTrainerSubstitutionCancellationTargetRequest>? targets,
        User currentUser,
        GymCrmDbContext dbContext,
        IAttendanceDatePolicy attendanceDatePolicy,
        CancellationToken cancellationToken)
    {
        if (targets is null || targets.Count == 0)
        {
            return TrainerSubstitutionCancellationValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["targets"] = ["Передайте хотя бы одну замену."]
            }));
        }

        var validated = new List<ValidatedTrainerSubstitutionCancellationTarget>();
        foreach (var requestTarget in targets)
        {
            if (!requestTarget.LessonOccurrenceId.HasValue ||
                !requestTarget.SubstitutionId.HasValue ||
                string.IsNullOrWhiteSpace(requestTarget.ExpectedRevision))
            {
                return TrainerSubstitutionCancellationValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["targets"] = ["Каждая цель должна содержать lessonOccurrenceId, substitutionId и expectedRevision."]
                }));
            }

            var lessonDate = ParseDate(requestTarget.LessonDate);
            if (!lessonDate.HasValue)
            {
                return TrainerSubstitutionCancellationValidation.Failure(TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["targets.lessonDate"] = [$"Дата занятия должна быть в формате {LessonDateFormat}."]
                }));
            }

            var target = await ResolveLessonForMutationAsync(
                requestTarget.LessonOccurrenceId.Value,
                lessonDate.Value,
                currentUser,
                dbContext,
                cancellationToken);
            if (target?.Occurrence is null)
            {
                return TrainerSubstitutionCancellationValidation.Failure(CreateOccurrenceNotFoundProblem());
            }

            var currentLesson = MapResolvedMutationTarget(
                target,
                currentUser,
                attendanceDatePolicy,
                await HasAttendanceMarksAsync(target.OccurrenceId, dbContext, cancellationToken));
            if (!string.Equals(requestTarget.ExpectedRevision!.Trim(), currentLesson.Revision, StringComparison.Ordinal))
            {
                return TrainerSubstitutionCancellationValidation.Failure(CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewStaleCode, StatusCodes.Status409Conflict));
            }

            var substitution = await dbContext.LessonOccurrenceTrainerSubstitutions
                .SingleOrDefaultAsync(candidate =>
                    candidate.Id == requestTarget.SubstitutionId.Value &&
                    candidate.LessonOccurrenceId == target.OccurrenceId &&
                    candidate.CancelledAt == null,
                    cancellationToken);
            if (substitution is null)
            {
                return TrainerSubstitutionCancellationValidation.Failure(CreateLessonMutationProblem("lesson-trainer-substitution-not-active", StatusCodes.Status409Conflict));
            }

            validated.Add(new ValidatedTrainerSubstitutionCancellationTarget(target, substitution, requestTarget.ExpectedRevision.Trim(), []));
        }

        return new TrainerSubstitutionCancellationValidation(null, validated, []);
    }

    private static async Task<IReadOnlyList<ScheduleWarningResponse>> BuildTrainerSubstitutionWarningsAsync(
        ResolvedLessonMutationTarget target,
        Guid substituteTrainerId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var warnings = new List<ScheduleWarningResponse>();
        var materializedCandidates = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                occurrence.Id != target.OccurrenceId &&
                occurrence.LessonDate == target.LessonDate &&
                occurrence.Status == LessonOccurrenceStatus.Scheduled &&
                (occurrence.Group.TrainerAssignments.Any(assignment =>
                        assignment.TrainerId == substituteTrainerId &&
                        assignment.ValidFrom <= target.LessonDate &&
                        (assignment.ValidTo == null || assignment.ValidTo >= target.LessonDate)) ||
                    occurrence.TrainerSubstitutions.Any(substitution =>
                        substitution.SubstituteTrainerId == substituteTrainerId &&
                        substitution.CancelledAt == null)))
            .Select(occurrence => new { occurrence.StartTime, occurrence.DurationMinutes })
            .ToArrayAsync(cancellationToken);
        var materializedConflict = materializedCandidates.Any(occurrence => ScheduleTimeRangePolicy.Overlaps(
            target.StartTime,
            target.DurationMinutes,
            occurrence.StartTime,
            occurrence.DurationMinutes));
        if (materializedConflict)
        {
            warnings.Add(new ScheduleWarningResponse(
                "lesson_trainer_overlap",
                "У замещающего тренера есть пересекающееся занятие."));
        }

        return warnings;
    }

    private static async Task<LessonOccurrence> MaterializeSubstitutionTargetAsync(
        ResolvedLessonMutationTarget target,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (target.Occurrence is not null)
        {
            return target.Occurrence;
        }

        var existing = await dbContext.LessonOccurrences
            .SingleOrDefaultAsync(occurrence => occurrence.Id == target.OccurrenceId, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var occurrence = new LessonOccurrence
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
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = target.SourceKind,
            CreatedAt = now,
            UpdatedAt = now
        };
        dbContext.LessonOccurrences.Add(occurrence);
        await dbContext.SaveChangesAsync(cancellationToken);
        return occurrence;
    }

    private static async Task<ScheduleLessonResponse> LoadMaterializedLessonAsync(
        Guid occurrenceId,
        User currentUser,
        IAttendanceDatePolicy attendanceDatePolicy,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var occurrence = await dbContext.LessonOccurrences
            .AsNoTracking()
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
            .AsSplitQuery()
            .SingleAsync(candidate => candidate.Id == occurrenceId, cancellationToken);
        return MapMaterializedLesson(occurrence, currentUser, attendanceDatePolicy, new HashSet<Guid>());
    }

    private static async Task<ScheduleMutationTokenResult> LoadScheduleMutationTokenAsync(
        string rawToken,
        Guid actorUserId,
        string purpose,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(rawToken.Trim());
        var token = await dbContext.ScheduleMutationConfirmationTokens
            .SingleOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ActorUserId == actorUserId &&
                candidate.Purpose == purpose,
                cancellationToken);
        if (token is null || token.ConsumedAt is not null)
        {
            return ScheduleMutationTokenResult.Failure(CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewInvalidCode, StatusCodes.Status409Conflict));
        }

        if (token.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            return ScheduleMutationTokenResult.Failure(CreateConfirmationTokenProblem(ScheduleMutationTokenPolicy.PreviewExpiredCode, StatusCodes.Status409Conflict));
        }

        return new ScheduleMutationTokenResult(null, token);
    }

    private static ScheduleLessonTrainerSubstitutionConfirmationPayload CreateTrainerSubstitutionPayload(
        Guid replacedTrainerId,
        Guid substituteTrainerId,
        IReadOnlyList<ValidatedTrainerSubstitutionTarget> targets,
        IReadOnlyList<ScheduleWarningResponse> warnings)
    {
        return new ScheduleLessonTrainerSubstitutionConfirmationPayload(
            replacedTrainerId,
            substituteTrainerId,
            targets
                .Select(target => new ScheduleLessonTrainerSubstitutionTargetConfirmationPayload(
                    target.Target.OccurrenceId,
                    target.Target.LessonDate.ToString(LessonDateFormat, CultureInfo.InvariantCulture),
                    target.ExpectedRevision))
                .OrderBy(target => target.LessonOccurrenceId)
                .ThenBy(target => target.LessonDate, StringComparer.Ordinal)
                .ToArray(),
            warnings.Select(warning => warning.Code).Order(StringComparer.Ordinal).ToArray());
    }

    private static ScheduleLessonTrainerSubstitutionCancellationConfirmationPayload CreateTrainerSubstitutionCancellationPayload(
        IReadOnlyList<ValidatedTrainerSubstitutionCancellationTarget> targets,
        string? reason,
        IReadOnlyList<ScheduleWarningResponse> warnings)
    {
        return new ScheduleLessonTrainerSubstitutionCancellationConfirmationPayload(
            targets
                .Select(target => new ScheduleLessonTrainerSubstitutionCancellationTargetConfirmationPayload(
                    target.Target.OccurrenceId,
                    target.Target.LessonDate.ToString(LessonDateFormat, CultureInfo.InvariantCulture),
                    target.Substitution.Id,
                    target.ExpectedRevision))
                .OrderBy(target => target.LessonOccurrenceId)
                .ThenBy(target => target.SubstitutionId)
                .ToArray(),
            NormalizeCancellationReason(reason),
            warnings.Select(warning => warning.Code).Order(StringComparer.Ordinal).ToArray());
    }

    private static string? NormalizeCancellationReason(string? reason)
    {
        var normalized = reason?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private sealed record TrainerSubstitutionValidation(
        IResult? Result,
        Guid ReplacedTrainerId,
        Guid SubstituteTrainerId,
        IReadOnlyList<ValidatedTrainerSubstitutionTarget> Targets,
        IReadOnlyList<ScheduleWarningResponse> Warnings)
    {
        public static TrainerSubstitutionValidation Failure(IResult result) => new(result, Guid.Empty, Guid.Empty, [], []);
    }

    private sealed record TrainerSubstitutionCancellationValidation(
        IResult? Result,
        IReadOnlyList<ValidatedTrainerSubstitutionCancellationTarget> Targets,
        IReadOnlyList<ScheduleWarningResponse> Warnings)
    {
        public static TrainerSubstitutionCancellationValidation Failure(IResult result) => new(result, [], []);
    }

    private sealed record ValidatedTrainerSubstitutionTarget(
        ResolvedLessonMutationTarget Target,
        string ExpectedRevision,
        IReadOnlyList<ScheduleWarningResponse> Warnings);

    private sealed record ValidatedTrainerSubstitutionCancellationTarget(
        ResolvedLessonMutationTarget Target,
        LessonOccurrenceTrainerSubstitution Substitution,
        string ExpectedRevision,
        IReadOnlyList<ScheduleWarningResponse> Warnings);

    private sealed record ScheduleMutationTokenResult(IResult? Result, ScheduleMutationConfirmationToken? Token)
    {
        public static ScheduleMutationTokenResult Failure(IResult result) => new(result, null);
    }
}
