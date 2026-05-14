using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class AttendanceEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);
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

    private static async Task<Results<Ok<IReadOnlyList<AttendanceGroupResponse>>, UnauthorizedHttpResult>> ListGroupsAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var query = dbContext.TrainingGroups.AsNoTracking();
        if (currentUser.Role == UserRole.Coach)
        {
            query = query.Where(group => group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id));
        }

        IReadOnlyList<AttendanceGroupResponse> response = await query
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

        return TypedResults.Ok(response);
    }

    private static async Task<Results<Ok<AttendanceGroupClientsResponse>, ValidationProblem, NotFound, ForbidHttpResult, UnauthorizedHttpResult>> GetGroupClientsAsync(
        Guid groupId,
        string? trainingDate,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
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
            return TypedResults.Forbid();
        }

        var parsedTrainingDate = ParseTrainingDate(trainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return AttendanceValidationProblems.CreateTrainingDateValidationProblem(TrainingDateFormat);
        }

        var group = await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == groupId, cancellationToken);

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

        return TypedResults.Ok(new AttendanceGroupClientsResponse(
            group.Id,
            group.Name,
            parsedTrainingDate.Value,
            clients
                .Select(client => MapAttendanceClient(client, currentUser, groupId, parsedTrainingDate.Value))
                .ToArray()));
    }

    private static async Task<Results<Ok<AttendanceSaveResponse>, ValidationProblem, NotFound, ForbidHttpResult, ProblemHttpResult, UnauthorizedHttpResult>> SaveAttendanceAsync(
        Guid groupId,
        SaveAttendanceRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        IAttendanceService attendanceService,
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
            return TypedResults.Forbid();
        }

        var parsedTrainingDate = ParseTrainingDate(request.TrainingDate);
        if (!parsedTrainingDate.HasValue)
        {
            return AttendanceValidationProblems.CreateTrainingDateValidationProblem(TrainingDateFormat);
        }

        if (request.AttendanceMarks is null || request.AttendanceMarks.Count == 0)
        {
            return AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceMarksRequired);
        }

        var mutationResult = await attendanceService.SaveAsync(
            new SaveAttendanceCommand(
                groupId,
                parsedTrainingDate.Value,
                currentUser.Id,
                request.AttendanceMarks
                    .Select(mark => new AttendanceMarkCommand(mark.ClientId, mark.IsPresent))
                    .ToArray()),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return mutationResult.Error switch
            {
                AttendanceBatchMutationError.GroupMissing => TypedResults.NotFound(),
                AttendanceBatchMutationError.InvalidRequest => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveInvalidRequest),
                AttendanceBatchMutationError.ClientOutsideGroup => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveClientOutsideGroup),
                _ => AttendanceValidationProblems.CreateAttendanceMarksValidationProblem(AttendanceResources.AttendanceSaveFailed)
            };
        }

        var details = mutationResult.Details!;
        var changedClientIds = details.Changes
            .Select(change => change.ClientId)
            .Distinct()
            .ToArray();

        var clientNames = changedClientIds.Length == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.Clients
                .AsNoTracking()
                .Where(client => changedClientIds.Contains(client.Id))
                .Select(client => new
                {
                    client.Id,
                    client.LastName,
                    client.FirstName,
                    client.MiddleName
                })
                .ToDictionaryAsync(
                    client => client.Id,
                    client => BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                    cancellationToken);

        var groupName = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => group.Id == groupId)
            .Select(group => group.Name)
            .SingleAsync(cancellationToken);

        foreach (var change in details.Changes)
        {
            var actionType = change.WasCreated
                ? AttendanceAuditConstants.AttendanceMarkedAction
                : AttendanceAuditConstants.AttendanceUpdatedAction;
            var description = change.WasCreated
                ? AttendanceResources.AttendanceMarkedDescription(
                    currentUser.Login,
                    clientNames.GetValueOrDefault(change.ClientId, change.ClientId.ToString()),
                    groupName,
                    details.TrainingDate.ToString(TrainingDateFormat, CultureInfo.InvariantCulture))
                : AttendanceResources.AttendanceUpdatedDescription(
                    currentUser.Login,
                    clientNames.GetValueOrDefault(change.ClientId, change.ClientId.ToString()),
                    groupName,
                    details.TrainingDate.ToString(TrainingDateFormat, CultureInfo.InvariantCulture));

            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    actionType,
                    AttendanceAuditConstants.AttendanceEntityType,
                    change.AttendanceId.ToString(),
                    description,
                    change.PreviousIsPresent.HasValue
                        ? SerializeAttendanceAuditState(change.ClientId, groupId, details.TrainingDate, change.PreviousIsPresent.Value)
                        : null,
                    SerializeAttendanceAuditState(change.ClientId, groupId, details.TrainingDate, change.CurrentIsPresent)),
                cancellationToken);
        }

        foreach (var writeOff in details.SingleVisitWriteOffs)
        {
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    AttendanceAuditConstants.ClientMembershipSingleVisitWrittenOffAction,
                    AttendanceAuditConstants.ClientMembershipEntityType,
                    writeOff.CurrentMembership.Id.ToString(),
                    AttendanceResources.ClientMembershipSingleVisitWrittenOffDescription(
                        currentUser.Login,
                        clientNames.GetValueOrDefault(writeOff.ClientId, writeOff.ClientId.ToString())),
                    SerializeMembershipAuditState(writeOff.ClientId, writeOff.PreviousMembership),
                    SerializeMembershipAuditState(writeOff.ClientId, writeOff.CurrentMembership)),
                cancellationToken);
        }

        return TypedResults.Ok(new AttendanceSaveResponse(
            details.GroupId,
            details.TrainingDate,
            details.Changes
                .Select(change => new AttendanceMarkResponse(change.ClientId, change.CurrentIsPresent))
                .ToArray()));
    }

    private static AttendanceClientResponse MapAttendanceClient(
        Client client,
        User currentUser,
        Guid groupId,
        DateOnly trainingDate)
    {
        var currentMembership = client.Memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .FirstOrDefault(membership => membership.ValidTo is null);
        var visibleGroups = currentUser.Role == UserRole.Coach
            ? client.Groups.Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id))
            : client.Groups.AsEnumerable();
        var warning = EvaluateMembershipWarning(client.IsProfessional, currentMembership, trainingDate);
        var isPresent = client.AttendanceEntries.Any(attendance =>
            attendance.GroupId == groupId &&
            attendance.TrainingDate == trainingDate &&
            attendance.IsPresent);

        return new AttendanceClientResponse(
            client.Id,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            MapGroups(visibleGroups),
            MapPhoto(client),
            isPresent,
            client.IsProfessional,
            client.ProfessionalComment,
            warning.HasWarning,
            warning.Message,
            ClientMembershipSemantics.HasUnpaidCurrentMembership(client.IsProfessional, currentMembership),
            ClientMembershipSemantics.HasActivePaidMembership(
                client.IsProfessional,
                currentMembership,
                trainingDate,
                requirePurchaseDateReached: true));
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

        if (issues.Contains(ClientMembershipIssue.Unpaid))
        {
            messages.Add(AttendanceResources.MembershipUnpaidWarning);
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

    private static string SerializeAttendanceAuditState(
        Guid clientId,
        Guid groupId,
        DateOnly trainingDate,
        bool isPresent)
    {
        return JsonSerializer.Serialize(
            new AttendanceAuditState(clientId, groupId, trainingDate, isPresent),
            AuditSerializerOptions);
    }

    private static string SerializeMembershipAuditState(
        Guid clientId,
        ClientMembershipSnapshotResult membership)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipAuditState(
                membership.Id,
                clientId,
                membership.SaleId,
                membership.MembershipType.ToString(),
                membership.PurchaseDate,
                membership.ExpirationDate,
                membership.PaymentAmount,
                membership.IsPaid,
                membership.SingleVisitUsed,
                membership.PaidByUserId,
                membership.PaidAt,
                membership.ChangeReason.ToString(),
                membership.ChangedByUserId,
                membership.ValidFrom,
                membership.ValidTo,
                membership.CreatedAt),
            AuditSerializerOptions);
    }

}
