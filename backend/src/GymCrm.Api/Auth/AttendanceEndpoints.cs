using System.Globalization;
using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
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
        group.MapGet("/groups/{groupId:guid}/clients", GetGroupClientsAsync);
        group.MapPost("/groups/{groupId:guid}", SaveAttendanceAsync);

        return endpoints;
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

        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == groupId, cancellationToken);
        var visibleGroupIds = currentUser.Role == UserRole.Coach
            ? (await accessScopeService.GetAccessScopeAsync(currentUser, cancellationToken)).AssignedGroupIds.ToHashSet()
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
                parsedTrainingDate.Value,
                cancellationToken);
        }

        var window = attendanceDatePolicy.GetWindow(currentUser.Role);
        return TypedResults.Ok(new AttendanceGroupClientsResponse(
            group.Id,
            group.Name,
            parsedTrainingDate.Value,
            window.Today,
            window.MinTrainingDate,
            window.MaxTrainingDate,
            clients
                .Select(client => MapAttendanceClient(
                    client,
                    currentUser,
                    visibleGroupIds,
                    groupId,
                    parsedTrainingDate.Value,
                    entitlementByClientId[client.Id]))
                .ToArray()));
    }

    private static async Task<Results<Ok<AttendanceSaveResponse>, ValidationProblem, NotFound, ForbidHttpResult, ProblemHttpResult, UnauthorizedHttpResult>> SaveAttendanceAsync(
        Guid groupId,
        SaveAttendanceRequest request,
        HttpContext httpContext,
        IAccessScopeService accessScopeService,
        IAttendanceService attendanceService,
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

        var mutationResult = await attendanceService.SaveAsync(
            new SaveAttendanceCommand(
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
                AttendanceBatchMutationError.InvalidRequest => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveInvalidRequest),
                AttendanceBatchMutationError.ClientOutsideGroup => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveClientOutsideGroup),
                AttendanceBatchMutationError.TrainingDateInFuture => AttendanceValidationProblems.CreateTrainingDateInFutureValidationProblem(),
                AttendanceBatchMutationError.TrainingDateUnavailable => AttendanceValidationProblems.CreateTrainingDateUnavailableValidationProblem(),
                AttendanceBatchMutationError.Forbidden => AttendanceValidationProblems.CreateAttendanceGroupForbiddenProblem(),
                AttendanceBatchMutationError.SingleVisitRestoreConflict => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.SingleVisitRestoreConflict),
                AttendanceBatchMutationError.MembershipEntitlementInvariantConflict => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem("Найдено несколько подходящих абонементов. Обновите карточку клиента или обратитесь к администратору."),
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

    private static AttendanceClientResponse MapAttendanceClient(
        Client client,
        User currentUser,
        IReadOnlySet<Guid>? visibleGroupIds,
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
            ? new MembershipWarningResult(true, "Найдено несколько подходящих абонементов. Обновите карточку клиента или обратитесь к администратору.")
            : EvaluateMembershipWarning(isProfessional, entitlementMembership, trainingDate);
        var attendance = client.AttendanceEntries.SingleOrDefault(attendance =>
            attendance.GroupId == groupId &&
            attendance.TrainingDate == trainingDate);
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

}
