using System.Globalization;
using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ClientQueryEndpoints
{
    internal static RouteGroupBuilder MapClientQueryEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", ListClientsAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClients);
        group.MapGet("/expiring-memberships", ListExpiringMembershipsAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapGet("/membership/expiration-suggestion", SuggestMembershipExpirationAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapGet("/{id:guid}", GetClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClients);

        return group;
    }

    private static async Task<Results<Ok<ClientListResponse>, ValidationProblem, ProblemHttpResult, ForbidHttpResult, UnauthorizedHttpResult>> ListClientsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? query,
        string? search,
        string? status,
        bool? isArchived,
        string? fullName,
        string? phone,
        Guid? groupId,
        string? paymentStatus,
        string? membershipState,
        string? behaviorKind,
        string? membershipExpiresFrom,
        string? membershipExpiresTo,
        bool? hasPhoto,
        bool? hasGroup,
        bool? hasCurrentMembership,
        bool? hasActivePaidMembership,
        bool? hasActiveMembership,
        string? quickFilters,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IEffectiveGroupAssignmentService effectiveGroupAssignmentService,
        IBusinessDateProvider businessDateProvider,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        if (!string.IsNullOrWhiteSpace(paymentStatus) ||
            string.Equals(membershipState, "Unpaid", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(membershipState, "Paid", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(membershipState, "ActivePaid", StringComparison.OrdinalIgnoreCase) ||
            hasActivePaidMembership.HasValue)
        {
            return CreateProblem(
                StatusCodes.Status400BadRequest,
                "membership-payment-filter-removed",
                "Membership payment filters were removed.",
                new Dictionary<string, string[]> { ["membership"] = ["Membership payment filters were removed."] });
        }

        var errors = ValidatePaging(page, pageSize, skip, take);
        foreach (var error in ValidateListFilters(
                     status,
                     paymentStatus,
                     membershipState,
                     behaviorKind,
                     membershipExpiresFrom,
                     membershipExpiresTo))
        {
            errors[error.Key] = error.Value;
        }

        var parsedQuickFilters = ParseQuickFilters(quickFilters, errors);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = ResolvePaging(page, pageSize, skip, take);
        var parsedStatus = ParseStatus(status);
        var parsedMembershipState = ParseMembershipState(membershipState);
        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        var membershipExpirationFrom = ParseIsoDate(membershipExpiresFrom);
        var membershipExpirationTo = ParseIsoDate(membershipExpiresTo);
        var hasElevatedClientAccess = UserRoleAuthorizationPolicy.GetOperationalScopeKind(currentUser.Role) != AccessScopeKind.AssignedGroups;
        var unifiedSearch = !string.IsNullOrWhiteSpace(query) ? query : search;
        var today = businessDateProvider.Today;
        var effectiveGroupIds = !hasElevatedClientAccess
            ? await effectiveGroupAssignmentService.ListEffectiveAssignedGroupIdsAsync(currentUser.Id, cancellationToken)
            : Array.Empty<Guid>();

        if (!hasElevatedClientAccess && !string.IsNullOrWhiteSpace(phone))
        {
            return TypedResults.Forbid();
        }

        var clientsQuery = dbContext.Clients.AsNoTracking();
        if (currentUser.Role == UserRole.Coach)
        {
            clientsQuery = ApplyCoachClientScope(clientsQuery, effectiveGroupIds);
        }

        if (!string.IsNullOrWhiteSpace(unifiedSearch))
        {
            clientsQuery = ApplyUnifiedSearch(clientsQuery, unifiedSearch, hasElevatedClientAccess);
        }

        if (!string.IsNullOrWhiteSpace(fullName))
        {
            clientsQuery = ApplyFullNameSearch(clientsQuery, fullName);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            clientsQuery = ApplyPhoneSearch(clientsQuery, phone);
        }

        if (groupId.HasValue)
        {
            clientsQuery = clientsQuery.Where(client => client.Groups.Any(clientGroup => clientGroup.GroupId == groupId.Value));
        }

        if (hasCurrentMembership.HasValue)
        {
            clientsQuery = hasCurrentMembership.Value
                ? clientsQuery.Where(client => client.Memberships.Any(membership => membership.ValidTo == null))
                : clientsQuery.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null));
        }

        if (parsedMembershipState.HasValue)
        {
            clientsQuery = ApplyMembershipStateFilter(clientsQuery, parsedMembershipState.Value, today);
        }

        if (parsedBehaviorKind.HasValue)
        {
            clientsQuery = clientsQuery.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.BehaviorKind == parsedBehaviorKind.Value));
        }

        if (hasActiveMembership.HasValue)
        {
            clientsQuery = hasActiveMembership.Value
                ? clientsQuery.Where(client => client.Memberships.Any(membership =>
                    membership.ValidTo == null &&
                    membership.TargetGroups.Any() &&
                    (!membership.IndividualValidFrom.HasValue || membership.IndividualValidFrom.Value <= today) &&
                    (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today) &&
                    (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed)))
                : clientsQuery.Where(client => !client.Memberships.Any(membership =>
                    membership.ValidTo == null &&
                    membership.TargetGroups.Any() &&
                    (!membership.IndividualValidFrom.HasValue || membership.IndividualValidFrom.Value <= today) &&
                    (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today) &&
                    (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed)));
        }

        if (hasPhoto.HasValue)
        {
            clientsQuery = hasPhoto.Value
                ? clientsQuery.Where(client =>
                    client.PhotoPath != null &&
                    client.PhotoPath != string.Empty &&
                    client.PhotoContentType != null &&
                    client.PhotoContentType != string.Empty &&
                    client.PhotoSizeBytes != null &&
                    client.PhotoUploadedAt != null)
                : clientsQuery.Where(client =>
                    client.PhotoPath == null ||
                    client.PhotoPath == string.Empty ||
                    client.PhotoContentType == null ||
                    client.PhotoContentType == string.Empty ||
                    client.PhotoSizeBytes == null ||
                    client.PhotoUploadedAt == null);
        }

        if (hasGroup.HasValue)
        {
            clientsQuery = hasGroup.Value
                ? clientsQuery.Where(client => client.Groups.Any())
                : clientsQuery.Where(client => !client.Groups.Any());
        }

        clientsQuery = ApplyMembershipExpirationFilter(
            clientsQuery,
            membershipExpirationFrom,
            membershipExpirationTo);

        var statuslessQuery = clientsQuery;
        if (parsedStatus.HasValue)
        {
            clientsQuery = clientsQuery.Where(client => client.Status == parsedStatus.Value);
        }

        if (isArchived.HasValue)
        {
            var archivedStatus = isArchived.Value
                ? ClientStatus.Archived
                : ClientStatus.Active;
            clientsQuery = clientsQuery.Where(client => client.Status == archivedStatus);
        }

        var quickFilterCountBaseQuery = clientsQuery;
        if (parsedQuickFilters.Count > 0)
        {
            clientsQuery = ApplyQuickFilters(
                clientsQuery,
                parsedQuickFilters,
                hasElevatedClientAccess,
                effectiveGroupIds,
                today);
        }

        var totalCount = await clientsQuery.CountAsync(cancellationToken);
        var quickFilterCounts = await BuildQuickFilterCountsAsync(
            quickFilterCountBaseQuery,
            hasElevatedClientAccess,
            effectiveGroupIds,
            today,
            cancellationToken);
        var activeCount = await statuslessQuery.CountAsync(
            client => client.Status == ClientStatus.Active,
            cancellationToken);
        var archivedCount = await statuslessQuery.CountAsync(
            client => client.Status == ClientStatus.Archived,
            cancellationToken);

        var orderedQuery = clientsQuery
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id);

        var projectedItems = await orderedQuery
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Select(client => new ClientListItemResponse(
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                ClientResponseMapper.BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                hasElevatedClientAccess ? client.Phone : string.Empty,
                client.BranchId,
                client.Branch.Name,
                client.Status.ToString(),
                client.Groups
                    .Where(clientGroup =>
                        hasElevatedClientAccess ||
                        effectiveGroupIds.Contains(clientGroup.GroupId))
                    .Select(clientGroup => clientGroup.GroupId)
                    .ToArray(),
                client.Groups
                    .Where(clientGroup =>
                        hasElevatedClientAccess ||
                        effectiveGroupIds.Contains(clientGroup.GroupId))
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
                    .ToArray(),
                hasElevatedClientAccess ? client.Contacts.Count : 0,
                !string.IsNullOrWhiteSpace(client.PhotoPath) &&
                !string.IsNullOrWhiteSpace(client.PhotoContentType) &&
                client.PhotoSizeBytes != null &&
                client.PhotoUploadedAt != null
                    ? new ClientPhotoSummaryResponse(
                        client.PhotoPath!,
                        client.PhotoContentType!,
                        client.PhotoSizeBytes.Value,
                        client.PhotoUploadedAt.Value,
                        true)
                    : null,
                client.Memberships.Any(membership =>
                    membership.ValidTo == null &&
                    membership.BehaviorKind == MembershipBehaviorKind.Professional &&
                    membership.TargetGroups.Any() &&
                    membership.IndividualValidFrom.HasValue &&
                    membership.IndividualValidFrom.Value <= today &&
                    (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today)),
                client.Memberships
                    .Where(membership =>
                        membership.ValidTo == null &&
                        membership.BehaviorKind == MembershipBehaviorKind.Professional &&
                        membership.TargetGroups.Any() &&
                        membership.IndividualValidFrom.HasValue &&
                        membership.IndividualValidFrom.Value <= today &&
                        (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today))
                    .OrderBy(membership => membership.Id)
                    .Select(membership => membership.ProfessionalComment)
                    .FirstOrDefault(),
                false,
                Array.Empty<ClientMembershipResponse>(),
                dbContext.ClientMemberships.Any(membership => membership.ClientId == client.Id && membership.ValidTo == null),
                ClientMembershipState.None.ToString(),
                dbContext.Attendance
                    .Where(attendance =>
                        attendance.ClientId == client.Id &&
                        attendance.IsPresent &&
                        (hasElevatedClientAccess ||
                         effectiveGroupIds.Contains(attendance.GroupId)))
                    .OrderByDescending(attendance => attendance.TrainingDate)
                    .ThenByDescending(attendance => attendance.UpdatedAt)
                    .ThenByDescending(attendance => attendance.Id)
                    .Select(attendance => (DateOnly?)attendance.TrainingDate)
                    .FirstOrDefault(),
                Array.Empty<ClientActionHintResponse>(),
                client.UpdatedAt))
            .ToArrayAsync(cancellationToken);
        var responseItems = await ClientResponseMapper.HydrateClientListItemsAsync(
            projectedItems,
            hasElevatedClientAccess,
            dbContext,
            effectiveGroupIds,
            today,
            cancellationToken);

        return TypedResults.Ok(new ClientListResponse(
            responseItems,
            totalCount,
            paging.Skip,
            paging.Take,
            paging.Skip / paging.Take + 1,
            paging.Take,
            paging.Skip + responseItems.Count < totalCount,
            activeCount,
            archivedCount,
            quickFilterCounts));
    }

    private static Results<Ok<ClientMembershipExpirationSuggestionResponse>, ValidationProblem> SuggestMembershipExpirationAsync(
        string? behaviorKind,
        string? startDate)
    {
        var errors = new Dictionary<string, string[]>();
        var parsedBehaviorKind = ValidateRequiredBehaviorKind(behaviorKind, errors);
        var parsedStartDate = ValidateRequiredDate(
            startDate,
            "startDate",
            ClientResources.MembershipStartDateRequired,
            errors);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        return TypedResults.Ok(new ClientMembershipExpirationSuggestionResponse(
            parsedBehaviorKind!.Value.ToString(),
            parsedStartDate!.Value,
            ClientMembershipSemantics.CalculateDefaultExpirationDate(parsedBehaviorKind.Value, parsedStartDate.Value)));
    }

    private static async Task<Results<Ok<IReadOnlyList<MembershipAttentionListItemResponse>>, UnauthorizedHttpResult>> ListExpiringMembershipsAsync(
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

        var today = businessDateProvider.Today;
        var expiresBefore = today.AddDays(ClientMembershipQueryConstants.ExpiringMembershipWindowDays);

        var candidates = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership =>
                membership.Client.Status == ClientStatus.Active &&
                membership.ValidTo == null &&
                membership.BehaviorKind != MembershipBehaviorKind.Professional &&
                membership.IndividualValidTo.HasValue &&
                membership.IndividualValidTo.Value < expiresBefore)
            .Select(membership => new
            {
                ClientId = membership.ClientId,
                membership.Client.LastName,
                membership.Client.FirstName,
                membership.Client.MiddleName,
                MembershipId = membership.Id,
                membership.SaleId,
                membership.BehaviorKind,
                MembershipName = membership.Sale.MembershipCatalogItem != null
                    ? membership.Sale.MembershipCatalogItem.Name
                    : ClientMembershipSaleDisplay.AmountOnlyLabel,
                ExpirationDate = membership.IndividualValidTo,
                TargetGroups = membership.TargetGroups
                    .OrderBy(target => target.Position)
                    .Select(target => new ClientMembershipTargetGroupResponse(
                        target.GroupId,
                        target.Group.Name,
                        target.BranchId,
                        target.Group.Branch.Name,
                        target.Position,
                        target.Group.IsActive))
                    .ToArray()
            })
            .ToArrayAsync(cancellationToken);

        IReadOnlyList<MembershipAttentionListItemResponse> response = candidates
            .Select(candidate => new
            {
                candidate.ClientId,
                candidate.MembershipId,
                candidate.SaleId,
                candidate.ExpirationDate,
                candidate.FirstName,
                candidate.LastName,
                candidate.MiddleName,
                candidate.BehaviorKind,
                candidate.MembershipName,
                candidate.TargetGroups,
                State = ResolveMembershipAttentionState(
                    candidate.ExpirationDate,
                    today,
                    expiresBefore)
            })
            .Where(candidate => candidate.State is not null)
            .OrderBy(candidate => GetMembershipAttentionSortGroup(candidate.State!))
            .ThenBy(candidate => GetMembershipAttentionDateSortValue(candidate.State!, candidate.ExpirationDate, today))
            .ThenBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.ClientId)
            .ThenBy(candidate => candidate.MembershipId)
            .Select(candidate => new MembershipAttentionListItemResponse(
                candidate.ClientId,
                ClientResponseMapper.BuildClientFullName(
                    candidate.LastName,
                    candidate.FirstName,
                    candidate.MiddleName),
                candidate.MembershipId,
                candidate.SaleId,
                candidate.BehaviorKind.ToString(),
                candidate.MembershipName,
                candidate.ExpirationDate,
                candidate.ExpirationDate.HasValue
                    ? candidate.ExpirationDate.Value.DayNumber - today.DayNumber
                    : null,
                candidate.TargetGroups,
                candidate.State!))
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static string? ResolveMembershipAttentionState(
        DateOnly? expirationDate,
        DateOnly today,
        DateOnly expiresBefore)
    {
        if (expirationDate.HasValue && expirationDate.Value < today)
        {
            return MembershipAttentionState.Expired;
        }

        if (expirationDate.HasValue && expirationDate.Value < expiresBefore)
        {
            return MembershipAttentionState.ExpiringSoon;
        }

        return null;
    }

    private static int GetMembershipAttentionSortGroup(string state)
    {
        return state switch
        {
            MembershipAttentionState.Expired => 0,
            MembershipAttentionState.ExpiringSoon => 1,
            _ => 3
        };
    }

    private static int GetMembershipAttentionDateSortValue(
        string state,
        DateOnly? expirationDate,
        DateOnly today)
    {
        if (!expirationDate.HasValue)
        {
            return int.MaxValue;
        }

        return state == MembershipAttentionState.Expired
            ? today.DayNumber - expirationDate.Value.DayNumber
            : expirationDate.Value.DayNumber - today.DayNumber;
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, ValidationProblem, NotFound, ForbidHttpResult, UnauthorizedHttpResult>> GetClientAsync(
        Guid id,
        int? attendanceSkip,
        int? attendanceTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IEffectiveGroupAssignmentService effectiveGroupAssignmentService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var attendancePagingErrors = ValidateAttendanceHistoryPaging(attendanceSkip, attendanceTake);
        if (attendancePagingErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(attendancePagingErrors);
        }

        var attendancePaging = ResolveAttendanceHistoryPaging(attendanceSkip, attendanceTake);
        var client = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        if (UserRoleAuthorizationPolicy.GetOperationalScopeKind(currentUser.Role) != AccessScopeKind.AssignedGroups)
        {
            var attendanceHistory = await ClientResponseMapper.LoadAttendanceHistoryAsync(
                client.Id,
                allowedGroupIds: null,
                attendancePaging,
                dbContext,
                cancellationToken);

            return TypedResults.Ok(ClientResponseMapper.MapDetails(client, attendanceHistory, businessDateProvider.Today, loggerFactory.CreateLogger("ClientNotesMetadata")));
        }

        var effectiveGroupIds = await effectiveGroupAssignmentService.ListEffectiveAssignedGroupIdsAsync(
            currentUser.Id,
            cancellationToken);
        var coachGroups = client.Groups
            .Where(clientGroup => effectiveGroupIds.Contains(clientGroup.GroupId))
            .ToArray();

        if (coachGroups.Length == 0)
        {
            return TypedResults.Forbid();
        }

        var coachGroupIds = coachGroups
            .Select(clientGroup => clientGroup.GroupId)
            .ToArray();
        var coachAttendanceHistory = await ClientResponseMapper.LoadAttendanceHistoryAsync(
            client.Id,
            coachGroupIds,
            attendancePaging,
            dbContext,
            cancellationToken);

        return TypedResults.Ok(ClientResponseMapper.MapCoachDetails(client, coachGroups, coachAttendanceHistory, businessDateProvider.Today, loggerFactory.CreateLogger("ClientNotesMetadata")));
    }


    private static ProblemHttpResult CreateProblem(
        int statusCode,
        string type,
        string title,
        Dictionary<string, string[]> errors)
    {
        return TypedResults.Problem(new HttpValidationProblemDetails(errors)
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = title
        });
    }


    private static Dictionary<string, string[]> ValidatePaging(int? page, int? pageSize, int? skip, int? take)
    {
        var errors = new Dictionary<string, string[]>();

        if (page.HasValue || pageSize.HasValue)
        {
            if (page is <= 0)
            {
                errors["page"] = [ClientResources.PageMustBeGreaterThanZero];
            }

            if (pageSize is <= 0 or > ClientApiConstants.MaxTake)
            {
                errors["pageSize"] = [ClientResources.PageSizeOutOfRange(ClientApiConstants.MaxTake)];
            }

            return errors;
        }

        if (skip is < 0)
        {
            errors["skip"] = [ClientResources.SkipCannotBeNegative];
        }

        if (take is <= 0 or > ClientApiConstants.MaxTake)
        {
            errors["take"] = [ClientResources.TakeOutOfRange(ClientApiConstants.MaxTake)];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateAttendanceHistoryPaging(int? attendanceSkip, int? attendanceTake)
    {
        var errors = new Dictionary<string, string[]>();

        if (attendanceSkip is < 0)
        {
            errors["attendanceSkip"] = [ClientResources.AttendanceSkipCannotBeNegative];
        }

        if (attendanceTake is <= 0 or > ClientApiConstants.MaxTake)
        {
            if (attendanceTake.HasValue)
            {
                errors["attendanceTake"] = [ClientResources.AttendanceTakeOutOfRange(ClientApiConstants.MaxTake)];
            }
        }

        return errors;
    }

    private static Paging ResolvePaging(int? page, int? pageSize, int? skip, int? take)
    {
        if (page.HasValue || pageSize.HasValue)
        {
            var resolvedPage = page ?? ClientApiConstants.DefaultPage;
            var resolvedPageSize = pageSize ?? ClientApiConstants.DefaultTake;
            return new Paging((resolvedPage - 1) * resolvedPageSize, resolvedPageSize);
        }

        return new Paging(skip ?? 0, take ?? ClientApiConstants.DefaultTake);
    }

    private static AttendanceHistoryPaging ResolveAttendanceHistoryPaging(int? attendanceSkip, int? attendanceTake)
    {
        return new AttendanceHistoryPaging(attendanceSkip ?? 0, attendanceTake ?? ClientApiConstants.DefaultTake);
    }


    private static Dictionary<string, string[]> ValidateListFilters(
        string? status,
        string? paymentStatus,
        string? membershipState,
        string? behaviorKind,
        string? membershipExpiresFrom,
        string? membershipExpiresTo)
    {
        var errors = new Dictionary<string, string[]>();

        if (!string.IsNullOrWhiteSpace(status) && ParseStatus(status) is null)
        {
            errors["status"] = [ClientResources.InvalidStatus];
        }

        if (!string.IsNullOrWhiteSpace(membershipState) && ParseMembershipState(membershipState) is null)
        {
            errors["membershipState"] = ["Некорректное состояние абонемента."];
        }

        if (!string.IsNullOrWhiteSpace(behaviorKind) && ParseBehaviorKind(behaviorKind) is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
        }

        var parsedMembershipExpiresFrom = ParseOptionalIsoDateFilter(
            membershipExpiresFrom,
            "membershipExpiresFrom",
            errors);
        var parsedMembershipExpiresTo = ParseOptionalIsoDateFilter(
            membershipExpiresTo,
            "membershipExpiresTo",
            errors);

        if (parsedMembershipExpiresFrom.HasValue &&
            parsedMembershipExpiresTo.HasValue &&
            parsedMembershipExpiresTo.Value < parsedMembershipExpiresFrom.Value)
        {
            errors["membershipExpiresTo"] = [ClientResources.MembershipExpirationRangeInvalid];
        }

        return errors;
    }

    private static IReadOnlyList<ClientQuickFilter> ParseQuickFilters(
        string? quickFilters,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(quickFilters))
        {
            return [];
        }

        var parsedFilters = new List<ClientQuickFilter>();
        var invalidFilters = new List<string>();

        foreach (var rawFilter in quickFilters.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (Enum.TryParse<ClientQuickFilter>(rawFilter, ignoreCase: true, out var parsedFilter))
            {
                if (!parsedFilters.Contains(parsedFilter))
                {
                    parsedFilters.Add(parsedFilter);
                }

                continue;
            }

            invalidFilters.Add(rawFilter);
        }

        if (invalidFilters.Count > 0)
        {
            errors["quickFilters"] =
            [
                $"Неизвестные быстрые фильтры: {string.Join(", ", invalidFilters)}."
            ];
        }

        return parsedFilters;
    }

    private static async Task<ClientQuickFilterCountsResponse> BuildQuickFilterCountsAsync(
        IQueryable<Client> baseQuery,
        bool hasElevatedClientAccess,
        IReadOnlyCollection<Guid> effectiveGroupIds,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        var withoutMembershipCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.WithoutMembership],
                hasElevatedClientAccess,
                effectiveGroupIds,
                today)
            .CountAsync(cancellationToken);
        var expiringSoonCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.ExpiringSoon],
                hasElevatedClientAccess,
                effectiveGroupIds,
                today)
            .CountAsync(cancellationToken);
        var withoutGroupCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.WithoutGroup],
                hasElevatedClientAccess,
                effectiveGroupIds,
                today)
            .CountAsync(cancellationToken);
        var trialCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.Trial],
                hasElevatedClientAccess,
                effectiveGroupIds,
                today)
            .CountAsync(cancellationToken);

        return new ClientQuickFilterCountsResponse(
            withoutMembershipCount,
            expiringSoonCount,
            withoutGroupCount,
            trialCount);
    }

    private static IQueryable<Client> ApplyQuickFilters(
        IQueryable<Client> query,
        IReadOnlyCollection<ClientQuickFilter> quickFilters,
        bool hasElevatedClientAccess,
        IReadOnlyCollection<Guid> effectiveGroupIds,
        DateOnly today)
    {
        var withoutMembership = quickFilters.Contains(ClientQuickFilter.WithoutMembership);
        var expiringSoon = quickFilters.Contains(ClientQuickFilter.ExpiringSoon);
        var withoutGroup = quickFilters.Contains(ClientQuickFilter.WithoutGroup);
        var trial = quickFilters.Contains(ClientQuickFilter.Trial);

        if (!withoutMembership && !expiringSoon && !withoutGroup && !trial)
        {
            return query;
        }

        var expiresBefore = today.AddDays(ClientMembershipQueryConstants.ExpiringMembershipWindowDays);

        return query.Where(client =>
            (withoutMembership &&
             !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) &&
             !client.Memberships.Any(membership => membership.ValidTo == null)) ||
            (expiringSoon &&
             client.Memberships.Any(membership =>
                    membership.ValidTo == null &&
                    membership.IndividualValidTo.HasValue &&
                    membership.IndividualValidTo.Value < expiresBefore)) ||
            (withoutGroup &&
             !client.Groups.Any(clientGroup =>
                 hasElevatedClientAccess ||
                 effectiveGroupIds.Contains(clientGroup.GroupId))) ||
            (trial &&
             client.Memberships.Any(membership =>
                 membership.ValidTo == null &&
                 membership.BehaviorKind == MembershipBehaviorKind.SingleVisit)));
    }


    private static MembershipBehaviorKind? ParseBehaviorKind(string? behaviorKind)
    {
        return Enum.TryParse<MembershipBehaviorKind>(behaviorKind?.Trim(), ignoreCase: true, out var parsedBehaviorKind)
            ? parsedBehaviorKind
            : null;
    }

    private static MembershipBehaviorKind? ValidateRequiredBehaviorKind(
        string? behaviorKind,
        Dictionary<string, string[]> errors)
    {
        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (!parsedBehaviorKind.HasValue)
        {
            errors["behaviorKind"] = ["Membership behavior kind is required."];
        }

        return parsedBehaviorKind;
    }

    private static DateOnly? ValidateRequiredDate(
        string? value,
        string field,
        string requiredMessage,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = [requiredMessage];
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (!parsedDate.HasValue)
        {
            errors[field] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static DateOnly? ParseIsoDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate)
            ? parsedDate
            : null;
    }


    private static IQueryable<Client> ApplyCoachClientScope(
        IQueryable<Client> query,
        IReadOnlyCollection<Guid> effectiveGroupIds)
    {
        return query.Where(client => client.Groups.Any(clientGroup => effectiveGroupIds.Contains(clientGroup.GroupId)));
    }

    private static IQueryable<Client> ApplyFullNameSearch(IQueryable<Client> query, string fullName)
    {
        var searchTerms = fullName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(term => term.ToUpperInvariant())
            .Where(term => term.Length > 0)
            .ToArray();

        foreach (var searchTerm in searchTerms)
        {
            query = query.Where(client =>
                (client.LastName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.FirstName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.MiddleName ?? string.Empty).ToUpper().Contains(searchTerm));
        }

        return query;
    }

    private static IQueryable<Client> ApplyUnifiedSearch(
        IQueryable<Client> query,
        string search,
        bool includePhone)
    {
        var searchTerms = search
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(term => term.ToUpperInvariant())
            .Where(term => term.Length > 0)
            .ToArray();
        var normalizedPhone = includePhone ? NormalizePhoneSearch(search) : string.Empty;

        if (searchTerms.Length == 0 && string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return query;
        }

        foreach (var searchTerm in searchTerms)
        {
            var normalizedSearchTerm = NormalizePhoneSearch(searchTerm);

            query = query.Where(client =>
                (client.LastName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.FirstName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (client.MiddleName ?? string.Empty).ToUpper().Contains(searchTerm) ||
                (includePhone &&
                 !string.IsNullOrWhiteSpace(normalizedSearchTerm) &&
                 client.Phone
                    .Replace(" ", string.Empty)
                    .Replace("-", string.Empty)
                    .Replace("(", string.Empty)
                    .Replace(")", string.Empty)
                    .Replace("+", string.Empty)
                    .Contains(normalizedSearchTerm)));
        }

        if (!string.IsNullOrWhiteSpace(normalizedPhone) &&
            !searchTerms.Contains(normalizedPhone, StringComparer.OrdinalIgnoreCase))
        {
            query = query.Where(client =>
                (client.LastName ?? string.Empty).ToUpper().Contains(normalizedPhone) ||
                (client.FirstName ?? string.Empty).ToUpper().Contains(normalizedPhone) ||
                (client.MiddleName ?? string.Empty).ToUpper().Contains(normalizedPhone) ||
                (includePhone &&
                 client.Phone
                    .Replace(" ", string.Empty)
                    .Replace("-", string.Empty)
                    .Replace("(", string.Empty)
                    .Replace(")", string.Empty)
                    .Replace("+", string.Empty)
                    .Contains(normalizedPhone)));
        }

        return query;
    }

    private static IQueryable<Client> ApplyPhoneSearch(IQueryable<Client> query, string phone)
    {
        var normalizedPhone = NormalizePhoneSearch(phone);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
        {
            return query;
        }

        return query.Where(client =>
            client.Phone != null &&
            client.Phone
                .Replace(" ", string.Empty)
                .Replace("-", string.Empty)
                .Replace("(", string.Empty)
                .Replace(")", string.Empty)
                .Replace("+", string.Empty)
                .Contains(normalizedPhone));
    }

    private static IQueryable<Client> ApplyMembershipExpirationFilter(
        IQueryable<Client> query,
        DateOnly? membershipExpirationFrom,
        DateOnly? membershipExpirationTo)
    {
        if (!membershipExpirationFrom.HasValue && !membershipExpirationTo.HasValue)
        {
            return query;
        }

        return query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.IndividualValidTo.HasValue &&
                (!membershipExpirationFrom.HasValue || membership.IndividualValidTo.Value >= membershipExpirationFrom.Value) &&
                (!membershipExpirationTo.HasValue || membership.IndividualValidTo.Value <= membershipExpirationTo.Value)));
    }

    private static string NormalizePhoneSearch(string phone)
    {
        return phone
            .Trim()
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty)
            .Replace("+", string.Empty);
    }

    private static IQueryable<Client> ApplyMembershipStateFilter(
        IQueryable<Client> query,
        ClientMembershipState membershipState,
        DateOnly today)
    {
        return membershipState switch
        {
            ClientMembershipState.None => query.Where(client =>
                !client.Memberships.Any(membership => membership.ValidTo == null)),
            ClientMembershipState.Expired => query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.TargetGroups.Any() &&
                membership.IndividualValidTo.HasValue &&
                membership.IndividualValidTo.Value < today)),
            ClientMembershipState.UsedSingleVisit => query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.TargetGroups.Any() &&
                membership.BehaviorKind == MembershipBehaviorKind.SingleVisit &&
                membership.SingleVisitUsed)),
            ClientMembershipState.Active => query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.TargetGroups.Any() &&
                (!membership.IndividualValidFrom.HasValue || membership.IndividualValidFrom.Value <= today) &&
                (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today) &&
                (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed))),
            ClientMembershipState.Future => query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                membership.TargetGroups.Any() &&
                membership.IndividualValidFrom.HasValue &&
                membership.IndividualValidFrom.Value > today)),
            ClientMembershipState.LegacyTargetMissing => query.Where(client => client.Memberships.Any(membership =>
                membership.ValidTo == null &&
                !membership.TargetGroups.Any())),
            _ => query
        };
    }

    private static DateOnly? ParseOptionalIsoDateFilter(
        string? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (!parsedDate.HasValue)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static ClientStatus? ParseStatus(string? status)
    {
        return Enum.TryParse<ClientStatus>(status?.Trim(), ignoreCase: true, out var parsedStatus)
            ? parsedStatus
            : null;
    }

    private static ClientMembershipState? ParseMembershipState(string? membershipState)
    {
        return Enum.TryParse<ClientMembershipState>(membershipState?.Trim(), ignoreCase: true, out var parsedMembershipState)
            ? parsedMembershipState
            : null;
    }

}
