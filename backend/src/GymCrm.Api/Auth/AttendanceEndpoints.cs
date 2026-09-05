using System.Globalization;
using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class AttendanceEndpoints
{
    private const string TrainingDateFormat = "yyyy-MM-dd";

    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/attendance")
            .RequireAuthorization(GymCrmAuthorizationPolicies.MarkAttendance);

        group.MapGet("/groups", ListGroupsAsync);
        group.MapGet("/lessons/today", ListTodayLessonsAsync);
        group.MapGet("/lessons/{lessonOccurrenceId:guid}/clients", GetLessonClientsAsync);
        group.MapPost("/lessons/{lessonOccurrenceId:guid}", SaveLessonAttendanceAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<AttendanceTodayLessonsResponse>, UnauthorizedHttpResult>> ListTodayLessonsAsync(
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

        var today = attendanceDatePolicy.GetWindow(currentUser.Role).Today;
        var lessons = (await ScheduleEndpoints.LoadScopedLessonsAsync(
                currentUser,
                today,
                today,
                dbContext,
                accessScopeService,
                attendanceDatePolicy,
                cancellationToken))
            .Where(lesson =>
                string.Equals(lesson.Status, "Scheduled", StringComparison.Ordinal) &&
                lesson.AllowedActions.ViewAttendance.Allowed)
            .ToArray();

        if (lessons.Length == 0)
        {
            return TypedResults.Ok(new AttendanceTodayLessonsResponse(today, []));
        }

        var groupIds = lessons.Select(lesson => lesson.GroupId).ToHashSet();
        var activeRoster = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active)
            .SelectMany(client => client.Groups
                .Where(clientGroup => groupIds.Contains(clientGroup.GroupId))
                .Select(clientGroup => new { clientGroup.GroupId, client.Id }))
            .ToArrayAsync(cancellationToken);
        var clientsByGroup = activeRoster
            .GroupBy(item => item.GroupId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.Id).ToHashSet());

        var occurrenceIds = lessons.Select(lesson => lesson.LessonOccurrenceId).ToHashSet();
        var markedClients = await dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => occurrenceIds.Contains(attendance.LessonOccurrenceId))
            .Select(attendance => new { attendance.LessonOccurrenceId, attendance.ClientId })
            .ToArrayAsync(cancellationToken);
        var markedClientsByOccurrence = markedClients
            .GroupBy(item => item.LessonOccurrenceId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.ClientId).ToHashSet());

        var items = lessons
            .Select(lesson =>
            {
                var activeClientIds = clientsByGroup.GetValueOrDefault(lesson.GroupId) ?? [];
                var markedClientIds = markedClientsByOccurrence.GetValueOrDefault(lesson.LessonOccurrenceId) ?? [];
                var unmarkedClientCount = activeClientIds.Count(clientId => !markedClientIds.Contains(clientId));
                return new AttendanceTodayLessonResponse(
                    lesson.LessonOccurrenceId,
                    lesson.LessonDate,
                    lesson.GroupId,
                    lesson.GroupName,
                    lesson.StartTime,
                    lesson.EndTime,
                    lesson.BranchName,
                    lesson.HallName,
                    lesson.EffectiveTrainers
                        .Select(trainer => new AttendanceTodayTrainerResponse(
                            trainer.TrainerId,
                            trainer.FullName,
                            trainer.Kind))
                        .ToArray(),
                    lesson.AllowedActions.ViewAttendance,
                    unmarkedClientCount);
            })
            .Where(lesson => lesson.UnmarkedClientCount > 0)
            .OrderBy(lesson => lesson.StartTime, StringComparer.Ordinal)
            .ThenBy(lesson => lesson.LessonOccurrenceId)
            .ToArray();

        return TypedResults.Ok(new AttendanceTodayLessonsResponse(today, items));
    }

    private static async Task<Results<Ok<AttendanceGroupsResponse>, UnauthorizedHttpResult>> ListGroupsAsync(
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

        var accessScope = await accessScopeService.GetAccessScopeAsync(currentUser, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.TrainingGroups.AsNoTracking();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(group => accessibleGroupIds.Contains(group.Id));
        }

        IReadOnlyList<AttendanceGroupResponse> groups = await query
            .OrderBy(group => group.IsActive ? 0 : 1)
            .ThenBy(group => group.Name)
            .ThenBy(group => group.TrainingStartTime)
            .ThenBy(group => group.Id)
            .Select(group => new AttendanceGroupResponse(
                group.Id,
                group.Name,
                group.BranchId,
                group.Branch.Name,
                group.HallId,
                group.Hall.Name,
                group.TrainingStartTime.ToString("HH\\:mm"),
                group.DurationMinutes,
                group.Weekdays,
                group.IsActive,
                group.Clients.Count(clientGroup => clientGroup.Client.Status == ClientStatus.Active)))
            .ToListAsync(cancellationToken);

        var window = attendanceDatePolicy.GetWindow(currentUser.Role);
        return TypedResults.Ok(new AttendanceGroupsResponse(
            groups,
            window.Today,
            window.MinTrainingDate,
            window.MaxTrainingDate));
    }

    private static async Task<Results<Ok<AttendanceGroupClientsResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetGroupClientsAsync(
        Guid groupId,
        string? trainingDate,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        IClientMembershipEntitlementResolver entitlementResolver,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var accessDecision = await accessScopeService.EvaluateGroupAccessAsync(
            currentUser,
            groupId,
            cancellationToken);

        if (accessDecision == GroupAccessDecision.GroupNotFound)
        {
            return TypedResults.NotFound();
        }

        if (accessDecision == GroupAccessDecision.Forbidden)
        {
            return AttendanceValidationProblems.CreateAttendanceGroupForbiddenProblem();
        }

        var parsedTrainingDate = ParseTrainingDate(trainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return AttendanceValidationProblems.CreateTrainingDateValidationProblem(TrainingDateFormat);
        }

        if (!attendanceDatePolicy.IsAllowed(currentUser.Role, parsedTrainingDate.Value))
        {
            return AttendanceValidationProblems.CreateTrainingDateUnavailableValidationProblem();
        }

        var lessonOccurrenceId = await ResolveGroupLessonOccurrenceIdAsync(
            dbContext,
            groupId,
            parsedTrainingDate.Value,
            cancellationToken);
        lessonOccurrenceId ??= LessonOccurrenceIdPolicy.CreateLegacyAttendance(groupId, parsedTrainingDate.Value);

        return await GetResolvedLessonClientsAsync(
            lessonOccurrenceId.Value,
            groupId,
            parsedTrainingDate.Value,
            currentUser,
            dbContext,
            accessScopeService,
            attendanceDatePolicy,
            entitlementResolver,
            cancellationToken);
    }

    private static async Task<Results<Ok<AttendanceGroupClientsResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetResolvedLessonClientsAsync(
        Guid lessonOccurrenceId,
        Guid groupId,
        DateOnly lessonDate,
        User currentUser,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        IClientMembershipEntitlementResolver entitlementResolver,
        CancellationToken cancellationToken,
        bool occurrenceScopeAccessAllowed = false)
    {
        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == groupId, cancellationToken);
        var visibleGroupIds = currentUser.Role == UserRole.Coach
            ? (await accessScopeService.GetAccessScopeAsync(currentUser, cancellationToken)).AssignedGroupIds
                .Append(occurrenceScopeAccessAllowed ? groupId : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToHashSet()
            : null;

        var clients = await dbContext.Clients
            .AsNoTracking()
                .Where(client =>
                    client.Status == ClientStatus.Active &&
                    client.Groups.Any(clientGroup => clientGroup.GroupId == groupId))
            .Include(client => client.Memberships)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .Include(client => client.AttendanceEntries)
            .AsSplitQuery()
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id)
            .ToListAsync(cancellationToken);

        var entitlementByClientId = new Dictionary<Guid, ClientMembershipEntitlementResolution>();
        foreach (var client in clients)
        {
            entitlementByClientId[client.Id] = await entitlementResolver.ResolveAsync(
                client.Id,
                groupId,
                lessonDate,
                cancellationToken);
        }

        var window = attendanceDatePolicy.GetWindow(currentUser.Role);
        return TypedResults.Ok(new AttendanceGroupClientsResponse(
            group.Id,
            group.Name,
            lessonDate,
            window.Today,
            window.MinTrainingDate,
            window.MaxTrainingDate,
            clients
                .Select(client => MapAttendanceClient(
                    client,
                    currentUser,
                    visibleGroupIds,
                    lessonOccurrenceId,
                    groupId,
                    lessonDate,
                    entitlementByClientId[client.Id]))
                .ToArray()));
    }

    private static async Task<Results<Ok<AttendanceGroupClientsResponse>, ValidationProblem, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> GetLessonClientsAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceDatePolicy attendanceDatePolicy,
        IClientMembershipEntitlementResolver entitlementResolver,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var parsedLessonDate = ParseTrainingDate(lessonDate);
        if (!parsedLessonDate.HasValue)
        {
            return AttendanceValidationProblems.CreateLessonDateValidationProblem(TrainingDateFormat);
        }

        var resolved = await ResolveAttendanceLessonOccurrenceAsync(
            lessonOccurrenceId,
            parsedLessonDate.Value,
            currentUser,
            dbContext,
            accessScopeService,
            cancellationToken);
        if (resolved is null)
        {
            return CreateLessonOccurrenceNotFoundProblem();
        }

        return await GetResolvedLessonClientsAsync(
            lessonOccurrenceId,
            resolved.GroupId,
            parsedLessonDate.Value,
            currentUser,
            dbContext,
            accessScopeService,
            attendanceDatePolicy,
            entitlementResolver,
            cancellationToken,
            resolved.IsOccurrenceScopedAccess);
    }

    private static async Task<Results<Ok<AttendanceSaveResponse>, ValidationProblem, NotFound, ForbidHttpResult, ProblemHttpResult, UnauthorizedHttpResult>> SaveAttendanceAsync(
        Guid groupId,
        SaveAttendanceRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceService attendanceService,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken,
        Guid? lessonOccurrenceId = null,
        bool occurrenceScopeAccessAllowed = false)
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

        var accessDecision = await accessScopeService.EvaluateGroupAccessAsync(
            currentUser,
            groupId,
            cancellationToken);

        if (accessDecision == GroupAccessDecision.GroupNotFound)
        {
            return TypedResults.NotFound();
        }

        if (accessDecision == GroupAccessDecision.Forbidden && !occurrenceScopeAccessAllowed)
        {
            return AttendanceValidationProblems.CreateAttendanceGroupForbiddenProblem();
        }

        var parsedTrainingDate = ParseTrainingDate(request.TrainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return AttendanceValidationProblems.CreateTrainingDateValidationProblem(TrainingDateFormat);
        }

        if (!attendanceDatePolicy.IsAllowed(currentUser.Role, parsedTrainingDate.Value))
        {
            return AttendanceValidationProblems.CreateTrainingDateUnavailableValidationProblem();
        }

        if (request.AttendanceMarks is null || request.AttendanceMarks.Count == 0)
        {
            return AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceMarksRequired);
        }

        var parsedMarks = new List<AttendanceMarkCommand>(request.AttendanceMarks.Count);
        foreach (var mark in request.AttendanceMarks)
        {
            var state = mark.State switch
            {
                nameof(AttendanceState.Unmarked) => AttendanceState.Unmarked,
                nameof(AttendanceState.Present) => AttendanceState.Present,
                nameof(AttendanceState.Absent) => AttendanceState.Absent,
                _ => (AttendanceState?)null
            };
            if (!state.HasValue)
            {
                return AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceStateInvalid);
            }

            parsedMarks.Add(new AttendanceMarkCommand(mark.ClientId, state.Value));
        }

        if (!lessonOccurrenceId.HasValue)
        {
            return CreateLegacyAttendanceWriteDisabledProblem();
        }

        var mutationResult = await attendanceService.SaveAsync(
            new SaveAttendanceCommand(
                lessonOccurrenceId.Value,
                groupId,
                parsedTrainingDate.Value,
                currentUser.Id,
                currentUser.Login,
                new AttendanceAuditContext(),
                parsedMarks),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return mutationResult.Error switch
            {
                AttendanceBatchMutationError.GroupMissing => TypedResults.NotFound(),
                AttendanceBatchMutationError.LessonOccurrenceMissing => CreateLessonOccurrenceNotFoundProblem(),
                AttendanceBatchMutationError.InvalidRequest => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveInvalidRequest),
                AttendanceBatchMutationError.ClientOutsideGroup => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveClientOutsideGroup),
                AttendanceBatchMutationError.TrainingDateInFuture => AttendanceValidationProblems.CreateTrainingDateInFutureValidationProblem(),
                AttendanceBatchMutationError.TrainingDateUnavailable => AttendanceValidationProblems.CreateTrainingDateUnavailableValidationProblem(),
                AttendanceBatchMutationError.Forbidden => AttendanceValidationProblems.CreateAttendanceGroupForbiddenProblem(),
                AttendanceBatchMutationError.LessonOccurrenceUnavailable => CreateLessonOccurrenceUnavailableProblem(),
                AttendanceBatchMutationError.SingleVisitRestoreConflict => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.SingleVisitRestoreConflict),
                AttendanceBatchMutationError.MembershipEntitlementInvariantConflict => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine462B0e5ed19),
                _ => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveFailed)
            };
        }

        var details = mutationResult.Details!;
        var window = attendanceDatePolicy.GetWindow(currentUser.Role);
        return TypedResults.Ok(new AttendanceSaveResponse(
            details.GroupId,
            details.TrainingDate,
            window.Today,
            window.MinTrainingDate,
            window.MaxTrainingDate,
            parsedMarks
                .Select(mark => new AttendanceMarkResponse(mark.ClientId, mark.State.ToString()))
                .ToArray()));
    }

    private static async Task<Results<Ok<AttendanceSaveResponse>, ValidationProblem, NotFound, ForbidHttpResult, ProblemHttpResult, UnauthorizedHttpResult>> SaveLessonAttendanceAsync(
        Guid lessonOccurrenceId,
        string? lessonDate,
        SaveAttendanceRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceService attendanceService,
        IAttendanceDatePolicy attendanceDatePolicy,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var parsedLessonDate = ParseTrainingDate(lessonDate);
        if (!parsedLessonDate.HasValue)
        {
            return AttendanceValidationProblems.CreateLessonDateValidationProblem(TrainingDateFormat);
        }

        var resolved = await ResolveAttendanceLessonOccurrenceAsync(
            lessonOccurrenceId,
            parsedLessonDate.Value,
            currentUser,
            dbContext,
            accessScopeService,
            cancellationToken);
        if (resolved is null)
        {
            return CreateLessonOccurrenceNotFoundProblem();
        }

        return await SaveAttendanceAsync(
            resolved.GroupId,
            request with { TrainingDate = lessonDate },
            httpContext,
            dbContext,
            accessScopeService,
            attendanceService,
            attendanceDatePolicy,
            antiforgery,
            cancellationToken,
            lessonOccurrenceId,
            resolved.IsOccurrenceScopedAccess);
    }

    private static async Task<LegacyScheduleOccurrenceResolution?> ResolveAttendanceLessonOccurrenceAsync(
        Guid lessonOccurrenceId,
        DateOnly lessonDate,
        User currentUser,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence => occurrence.Id == lessonOccurrenceId && occurrence.LessonDate == lessonDate)
            .Select(occurrence => new
            {
                occurrence.GroupId,
                occurrence.LessonDate,
                occurrence.StartTime,
                occurrence.DurationMinutes,
                IsOccurrenceScopedAccess = occurrence.TrainerSubstitutions.Any(substitution =>
                    substitution.SubstituteTrainerId == currentUser.Id &&
                    substitution.CancelledAt == null)
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (materialized is not null)
        {
            var accessDecision = await accessScopeService.EvaluateGroupAccessAsync(
                currentUser,
                materialized.GroupId,
                cancellationToken);
            return accessDecision == GroupAccessDecision.Allowed || materialized.IsOccurrenceScopedAccess
                ? new LegacyScheduleOccurrenceResolution(
                    materialized.GroupId,
                    materialized.LessonDate,
                    materialized.StartTime,
                    materialized.DurationMinutes,
                    accessDecision != GroupAccessDecision.Allowed && materialized.IsOccurrenceScopedAccess)
                : null;
        }

        return await ScheduleEndpoints.ResolveLegacyProjectedOccurrenceAsync(
            lessonOccurrenceId,
            lessonDate,
            currentUser,
            dbContext,
            accessScopeService,
            cancellationToken);
    }

    private static AttendanceClientResponse MapAttendanceClient(
        Client client,
        User currentUser,
        IReadOnlySet<Guid>? visibleGroupIds,
        Guid lessonOccurrenceId,
        Guid groupId,
        DateOnly trainingDate,
        ClientMembershipEntitlementResolution entitlement)
    {
        var entitlementMembership = entitlement.MembershipId.HasValue
            ? client.Memberships.SingleOrDefault(membership => membership.Id == entitlement.MembershipId.Value)
            : null;
        var visibleGroups = currentUser.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => visibleGroupIds?.Contains(clientGroup.GroupId) == true)
            : client.Groups.AsEnumerable();
        var isProfessional = entitlement is
        {
            Status: ClientMembershipEntitlementResolutionStatus.Found,
            BehaviorKind: MembershipBehaviorKind.Professional
        };
        var warning = entitlement.Status == ClientMembershipEntitlementResolutionStatus.InvariantConflict
            ? new MembershipWarningResult(true, global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine598B0e5ed19)
            : EvaluateMembershipWarning(isProfessional, entitlementMembership, trainingDate);
        var attendance = client.AttendanceEntries.SingleOrDefault(attendance =>
            attendance.LessonOccurrenceId == lessonOccurrenceId);
        var state = attendance is null
            ? AttendanceState.Unmarked
            : attendance.IsPresent
                ? AttendanceState.Present
                : AttendanceState.Absent;

        return new AttendanceClientResponse(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            MapGroups(visibleGroups),
            MapPhoto(client),
            state.ToString(),
            isProfessional,
            isProfessional ? entitlementMembership?.ProfessionalComment : null,
            warning.HasWarning,
            warning.Message,
            entitlement.Status == ClientMembershipEntitlementResolutionStatus.Found);
    }

    private static async Task<Guid?> ResolveGroupLessonOccurrenceIdAsync(
        GymCrmDbContext dbContext,
        Guid groupId,
        DateOnly lessonDate,
        CancellationToken cancellationToken)
    {
        var materialized = await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence => occurrence.GroupId == groupId && occurrence.LessonDate == lessonDate)
            .Select(occurrence => (Guid?)occurrence.Id)
            .ToArrayAsync(cancellationToken);
        if (materialized.Length == 1)
        {
            return materialized[0];
        }

        if (materialized.Length > 1)
        {
            return null;
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

        var projectedIds = series
            .SelectMany(candidate => candidate.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= lessonDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= lessonDate))
                .SelectMany(version => version.Slots
                    .Where(slot => slot.IsoWeekday == weekday)
                    .Select(slot => LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, lessonDate))))
            .Distinct()
            .ToArray();

        return projectedIds.Length == 1 ? projectedIds[0] : null;
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private static MembershipWarningResult EvaluateMembershipWarning(
        bool isProfessional,
        ClientMembership? membership,
        DateOnly trainingDate)
    {
        var issues = ClientMembershipSemantics.EvaluateIssues(isProfessional, membership, trainingDate);
        if (issues.Count == 0)
        {
            return new MembershipWarningResult(false, null);
        }

        if (issues.Contains(ClientMembershipIssue.NoCurrentMembership))
        {
            return new MembershipWarningResult(
                true,
                AttendanceResources.NoCurrentMembershipWarning);
        }

        var messages = new List<string>();
        if (issues.Contains(ClientMembershipIssue.PurchasedAfterTrainingDate))
        {
            messages.Add(AttendanceResources.MembershipPurchasedLaterWarning);
        }

        if (issues.Contains(ClientMembershipIssue.SingleVisitAlreadyUsed))
        {
            messages.Add(AttendanceResources.SingleVisitAlreadyUsedWarning);
        }

        if (issues.Contains(ClientMembershipIssue.Expired))
        {
            messages.Add(AttendanceResources.MembershipExpiredWarning);
        }

        return messages.Count == 0
            ? new MembershipWarningResult(false, null)
            : new MembershipWarningResult(
                true,
                AttendanceResources.MembershipWarningWithDetails(string.Join(", ", messages)));
    }

    private static IReadOnlyList<ClientGroupSummaryResponse> MapGroups(IEnumerable<ClientGroup> groups)
    {
        return groups
            .Select(clientGroup => new ClientGroupSummaryResponse(
                clientGroup.GroupId,
                clientGroup.Group.Name,
                clientGroup.Group.BranchId,
                clientGroup.Group.Branch.Name,
                clientGroup.Group.HallId,
                clientGroup.Group.Hall.Name,
                clientGroup.Group.IsActive,
                clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                clientGroup.Group.DurationMinutes,
                clientGroup.Group.Weekdays))
            .OrderBy(group => group.Name, StringComparer.CurrentCulture)
            .ThenBy(group => group.Id)
            .ToArray();
    }

    private static ClientPhotoSummaryResponse? MapPhoto(Client client)
    {
        if (string.IsNullOrWhiteSpace(client.PhotoPath) ||
            string.IsNullOrWhiteSpace(client.PhotoContentType) ||
            client.PhotoSizeBytes is null ||
            client.PhotoUploadedAt is null)
        {
            return null;
        }

        return new ClientPhotoSummaryResponse(
            client.PhotoPath,
            client.PhotoContentType,
            client.PhotoSizeBytes.Value,
            client.PhotoUploadedAt.Value,
            true);
    }

    private static DateOnly? ParseTrainingDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            TrainingDateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate)
            ? parsedDate
            : null;
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? ClientResources.ClientWithoutName
            : fullName;
    }

    private static ProblemHttpResult CreateLessonOccurrenceNotFoundProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/lesson-occurrence-not-found",
            Title = global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine781A0d4e31f,
            Status = StatusCodes.Status404NotFound,
            Extensions =
            {
                ["code"] = "lesson-occurrence-not-found"
            }
        });
    }

    private static ProblemHttpResult CreateLessonOccurrenceUnavailableProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/lesson-attendance-state-conflict",
            Title = global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine795A47bee81,
            Status = StatusCodes.Status409Conflict,
            Extensions =
            {
                ["code"] = "lesson-attendance-state-conflict"
            }
        });
    }

    private static ProblemHttpResult CreateLegacyAttendanceWriteDisabledProblem()
    {
        return TypedResults.Problem(new ProblemDetails
        {
            Type = "/problems/attendance-legacy-write-disabled",
            Title = global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine809Acdeea91,
            Detail = global::GymCrm.Api.UserFacingText.BE4AttendanceText.AttendanceEndpointsLine81084c16769,
            Status = StatusCodes.Status410Gone
        });
    }

}
