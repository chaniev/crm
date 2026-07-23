using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ClientEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapClientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients");

        group.MapGet("/", ListClientsAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClients);
        group.MapGet("/expiring-memberships", ListExpiringMembershipsAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapGet("/membership/expiration-suggestion", SuggestMembershipExpirationAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/", CreateClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}", UpdateClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/transfer", TransferClientBranchAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/archive", ArchiveClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/restore", RestoreClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/purchase", PurchaseMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/renew", RenewMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/correct", CorrectMembershipAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/mark-payment", MarkMembershipPaymentAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/sales/{saleId:guid}/refunds", RegisterMembershipRefundAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/membership/sales/{saleId:guid}/comment", UpdateMembershipCommentAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPost("/{id:guid}/membership/refunds/{refundId:guid}/cancel", CancelMembershipRefundAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapGet("/{id:guid}", GetClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewClients);

        return endpoints;
    }

    private static async Task<Results<Ok<ClientListResponse>, ValidationProblem, ForbidHttpResult, UnauthorizedHttpResult>> ListClientsAsync(
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
        string? quickFilters,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
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
        var parsedPaymentStatus = ParsePaymentStatus(paymentStatus);
        var parsedMembershipState = ParseMembershipState(membershipState);
        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        var membershipExpirationFrom = ParseIsoDate(membershipExpiresFrom);
        var membershipExpirationTo = ParseIsoDate(membershipExpiresTo);
        var hasElevatedClientAccess = currentUser.Role is UserRole.HeadCoach or UserRole.Administrator;
        var unifiedSearch = !string.IsNullOrWhiteSpace(query) ? query : search;
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        if (!hasElevatedClientAccess && !string.IsNullOrWhiteSpace(phone))
        {
            return TypedResults.Forbid();
        }

        var clientsQuery = dbContext.Clients.AsNoTracking();
        if (currentUser.Role == UserRole.Coach)
        {
            clientsQuery = ApplyCoachClientScope(clientsQuery, currentUser.Id, dbContext);
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

        if (parsedPaymentStatus.HasValue)
        {
            clientsQuery = parsedPaymentStatus.Value switch
            {
                ClientPaymentStatus.Paid => clientsQuery.Where(client => client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) || client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(membership => membership.IsPaid)),
                ClientPaymentStatus.Unpaid => clientsQuery.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(membership => !membership.IsPaid)),
                _ => clientsQuery
            };
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
            clientsQuery = clientsQuery.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.BehaviorKind == parsedBehaviorKind.Value));
        }

        if (hasActivePaidMembership.HasValue)
        {
            clientsQuery = hasActivePaidMembership.Value
                ? clientsQuery.Where(client => client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) || client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.IndividualValidTo == null || membership.IndividualValidTo >= today) &&
                            (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed))
                    )
                : clientsQuery.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && !client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.IndividualValidTo == null || membership.IndividualValidTo >= today) &&
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
                currentUser.Id,
                today);
        }

        var totalCount = await clientsQuery.CountAsync(cancellationToken);
        var quickFilterCounts = await BuildQuickFilterCountsAsync(
            quickFilterCountBaseQuery,
            hasElevatedClientAccess,
            currentUser.Id,
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
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
                hasElevatedClientAccess ? client.Phone : string.Empty,
                client.BranchId,
                client.Branch.Name,
                client.Status.ToString(),
                client.Groups
                    .Where(clientGroup =>
                        hasElevatedClientAccess ||
                        clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id))
                    .Select(clientGroup => clientGroup.GroupId)
                    .ToArray(),
                client.Groups
                    .Where(clientGroup =>
                        hasElevatedClientAccess ||
                        clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id))
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
                client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)),
                client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(),
                client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) || dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.IndividualValidTo == null || membership.IndividualValidTo >= today) &&
                            (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed)),
                !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(membership => !membership.IsPaid),
                dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership => new CurrentMembershipSummaryResponse(
                        membership.Id,
                        membership.Sale.MembershipCatalogItemId,
                        membership.Sale.MembershipCatalogItem != null
                            ? membership.Sale.MembershipCatalogItem.Name
                            : ClientMembershipSaleDisplay.AmountOnlyLabel,
                        membership.BehaviorKind.ToString(),
                        membership.Sale.PricingMode.ToString(),
                        membership.Sale.GrossAmount,
                        membership.Sale.MembershipCatalogItem != null
                            ? membership.Sale.MembershipCatalogItem.Price
                            : null,
                        membership.Sale.PurchaseDate,
                        membership.IndividualValidTo,
                        membership.IsPaid,
                        membership.SingleVisitUsed))
                    .FirstOrDefault(),
                dbContext.ClientMemberships.Any(membership => membership.ClientId == client.Id && membership.ValidTo == null),
                client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today))
                    ? ClientMembershipState.ActivePaid.ToString()
                    : (dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership =>
                        !membership.IsPaid
                            ? ClientMembershipState.Unpaid.ToString()
                            : membership.IndividualValidTo != null && membership.IndividualValidTo < today
                                ? ClientMembershipState.Expired.ToString()
                                : membership.BehaviorKind == MembershipBehaviorKind.SingleVisit && membership.SingleVisitUsed
                                    ? ClientMembershipState.UsedSingleVisit.ToString()
                                    : ClientMembershipState.ActivePaid.ToString())
                    .FirstOrDefault() ?? ClientMembershipState.None.ToString()),
                dbContext.Attendance
                    .Where(attendance =>
                        attendance.ClientId == client.Id &&
                        attendance.IsPresent &&
                        (hasElevatedClientAccess ||
                         dbContext.GroupTrainers.Any(groupTrainer =>
                             groupTrainer.GroupId == attendance.GroupId &&
                             groupTrainer.TrainerId == currentUser.Id)))
                    .OrderByDescending(attendance => attendance.TrainingDate)
                    .ThenByDescending(attendance => attendance.UpdatedAt)
                    .ThenByDescending(attendance => attendance.Id)
                    .Select(attendance => (DateOnly?)attendance.TrainingDate)
                    .FirstOrDefault(),
                Array.Empty<ClientActionHintResponse>(),
                client.UpdatedAt))
            .ToArrayAsync(cancellationToken);
        var responseItems = await HydrateClientListItemsAsync(
            projectedItems,
            hasElevatedClientAccess,
            currentUser.Id,
            dbContext,
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
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var expiresBefore = today.AddDays(ClientMembershipQueryConstants.ExpiringMembershipWindowDays);

        var candidates = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active && !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)))
            .Select(client => new
            {
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                CurrentMembership = client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership => new
                    {
                        membership.BehaviorKind,
                        membership.IndividualValidTo,
                        membership.IsPaid
                    })
                    .FirstOrDefault()
            })
            .Where(candidate =>
                candidate.CurrentMembership != null &&
                (!candidate.CurrentMembership.IsPaid ||
                 candidate.CurrentMembership.IndividualValidTo.HasValue &&
                 candidate.CurrentMembership.IndividualValidTo.Value < expiresBefore))
            .Select(candidate => new
            {
                candidate.Id,
                candidate.LastName,
                candidate.FirstName,
                candidate.MiddleName,
                BehaviorKind = candidate.CurrentMembership!.BehaviorKind,
                IndividualValidTo = candidate.CurrentMembership!.IndividualValidTo,
                candidate.CurrentMembership!.IsPaid
            })
            .ToArrayAsync(cancellationToken);

        IReadOnlyList<MembershipAttentionListItemResponse> response = candidates
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IndividualValidTo,
                candidate.FirstName,
                candidate.LastName,
                candidate.MiddleName,
                candidate.BehaviorKind,
                candidate.IsPaid,
                State = ResolveMembershipAttentionState(
                    candidate.IndividualValidTo,
                    candidate.IsPaid,
                    today,
                    expiresBefore)
            })
            .Where(candidate => candidate.State is not null)
            .OrderBy(candidate => GetMembershipAttentionSortGroup(candidate.State!))
            .ThenBy(candidate => GetMembershipAttentionDateSortValue(candidate.State!, candidate.IndividualValidTo, today))
            .ThenBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.Id)
            .Select(candidate => new MembershipAttentionListItemResponse(
                candidate.Id,
                BuildClientFullName(
                    candidate.LastName,
                    candidate.FirstName,
                    candidate.MiddleName),
                candidate.BehaviorKind.ToString(),
                candidate.BehaviorKind.ToString(),
                candidate.IndividualValidTo,
                candidate.IndividualValidTo.HasValue
                    ? candidate.IndividualValidTo.Value.DayNumber - today.DayNumber
                    : null,
                candidate.IsPaid,
                candidate.State!))
            .ToArray();

        return TypedResults.Ok(response);
    }

    private static string? ResolveMembershipAttentionState(
        DateOnly? expirationDate,
        bool isPaid,
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

        return isPaid ? null : MembershipAttentionState.Unpaid;
    }

    private static int GetMembershipAttentionSortGroup(string state)
    {
        return state switch
        {
            MembershipAttentionState.Expired => 0,
            MembershipAttentionState.ExpiringSoon => 1,
            MembershipAttentionState.Unpaid => 2,
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
        var client = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        if (currentUser.Role is UserRole.HeadCoach or UserRole.Administrator)
        {
            var attendanceHistory = await LoadAttendanceHistoryAsync(
                client.Id,
                allowedGroupIds: null,
                attendancePaging,
                dbContext,
                cancellationToken);

            return TypedResults.Ok(MapDetails(client, attendanceHistory, loggerFactory.CreateLogger("ClientNotesMetadata")));
        }

        var coachGroups = client.Groups
            .Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUser.Id))
            .ToArray();

        if (coachGroups.Length == 0)
        {
            return TypedResults.Forbid();
        }

        var coachGroupIds = coachGroups
            .Select(clientGroup => clientGroup.GroupId)
            .ToArray();
        var coachAttendanceHistory = await LoadAttendanceHistoryAsync(
            client.Id,
            coachGroupIds,
            attendancePaging,
            dbContext,
            cancellationToken);

        return TypedResults.Ok(MapCoachDetails(client, coachGroups, coachAttendanceHistory, loggerFactory.CreateLogger("ClientNotesMetadata")));
    }

    private static async Task<Results<Created<ClientDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateClientAsync(
        UpsertClientRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        ILoggerFactory loggerFactory,
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

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var now = DateTimeOffset.UtcNow;
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = normalizedRequest.BranchId!.Value,
            LastName = normalizedRequest.LastName,
            FirstName = normalizedRequest.FirstName,
            MiddleName = normalizedRequest.MiddleName,
            Phone = normalizedRequest.Phone,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        var noteTransition = ClientNotesMetadataPolicy.Apply(client, normalizedRequest.Notes, currentUser.Id, now);

        dbContext.Clients.Add(client);
        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        OpenBranchAssignment(client.Id, normalizedRequest.BranchId!.Value, currentUser.Id, now, dbContext);
        await ReplaceGroupAssignmentsAsync(
            client.Id,
            normalizedRequest.BranchId!.Value,
            normalizedRequest.GroupIds,
            currentUser.Id,
            now,
            dbContext,
            cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        var createdClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created client '{client.Id}' was not found.");

        await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.ClientCreatedAction,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                ClientAuditResources.ClientCreatedDescription(
                    currentUser.Login,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
                NewValueJson: SerializeAuditState(createdClient)), cancellationToken);

        if (noteTransition is not null)
        {
            await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
                BuildNoteAuditEntry(currentUser.Id, client, currentUser.Login, noteTransition), cancellationToken);
        }

        return TypedResults.Created($"/clients/{client.Id}", MapDetails(createdClient, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientAsync(
        Guid id,
        UpsertClientRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        ILoggerFactory loggerFactory,
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

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            client.BranchId);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldStateSnapshot = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        var oldState = SerializeAuditState(oldStateSnapshot ?? client);

        client.LastName = normalizedRequest.LastName;
        client.FirstName = normalizedRequest.FirstName;
        client.MiddleName = normalizedRequest.MiddleName;
        client.Phone = normalizedRequest.Phone;
        client.BranchId = normalizedRequest.BranchId!.Value;
        var now = DateTimeOffset.UtcNow;
        var noteTransition = ClientNotesMetadataPolicy.Apply(client, normalizedRequest.Notes, currentUser.Id, now);
        client.UpdatedAt = now;

        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        await ReplaceGroupAssignmentsAsync(
            client.Id,
            normalizedRequest.BranchId!.Value,
            normalizedRequest.GroupIds,
            currentUser.Id,
            now,
            dbContext,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{client.Id}' was not found.");

        await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.ClientUpdatedAction,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                ClientAuditResources.ClientUpdatedDescription(
                    currentUser.Login,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
                oldState,
                SerializeAuditState(updatedClient)), cancellationToken);

        if (noteTransition is not null)
        {
            await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
                BuildNoteAuditEntry(currentUser.Id, client, currentUser.Login, noteTransition), cancellationToken);
        }

        return TypedResults.Ok(MapDetails(updatedClient, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> TransferClientBranchAsync(
        Guid id,
        TransferClientBranchRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
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

        var client = await dbContext.Clients
            .Include(candidate => candidate.Groups)
            .Include(candidate => candidate.Memberships)
                .ThenInclude(membership => membership.Sale)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = await ValidateTransferRequestAsync(request, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldStateSnapshot = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        var oldState = SerializeAuditState(oldStateSnapshot ?? client);
        var targetBranchId = (request.TargetBranchId ?? request.BranchId)!.Value;
        var targetGroupIds = NormalizeTransferGroupIds(request);
        var now = DateTimeOffset.UtcNow;
        var today = businessDateProvider.Today;
        var currentMembership = GetCurrentMembership(client);
        var preserveSingleVisit = currentMembership is
            { BehaviorKind: MembershipBehaviorKind.SingleVisit, SingleVisitUsed: false };

        if (preserveSingleVisit)
        {
            if (request.PresentSaleFields.Count > 0)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    [request.PresentSaleFields.Order(StringComparer.Ordinal).First()] =
                        ["Active unused SingleVisit is transferred without a new membership or financial event."]
                });
            }
        }
        else if (!request.MembershipCatalogItemId.HasValue && !request.ManualSaleAmount.HasValue)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Choose a catalog item or provide a manual sale amount."],
                ["manualSaleAmount"] = ["Choose a catalog item or provide a manual sale amount."]
            });
        }

        MembershipBehaviorKind? transferBehavior = null;
        if (!preserveSingleVisit)
        {
            var pricingErrors = new Dictionary<string, string[]>();
            ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, pricingErrors);
            ValidateCatalogPayment(request.PaymentStatus, request.PaymentDate, pricingErrors);
            if (pricingErrors.Count > 0)
                return TypedResults.ValidationProblem(pricingErrors);

            transferBehavior = request.MembershipCatalogItemId.HasValue
                ? await dbContext.MembershipCatalogItems
                    .Where(item => item.Id == request.MembershipCatalogItemId.Value)
                    .Select(item => (MembershipBehaviorKind?)item.BehaviorKind)
                    .SingleOrDefaultAsync(cancellationToken)
                : MembershipBehaviorKind.Term;
            if (transferBehavior == MembershipBehaviorKind.Professional && currentUser.Role != UserRole.HeadCoach)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["membershipCatalogItemId"] = ["Only HeadCoach can assign Professional membership."]
                });
            }
            if (transferBehavior is MembershipBehaviorKind.Term or MembershipBehaviorKind.Professional &&
                ParseIsoDate(request.ValidFrom) != today)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["validFrom"] = ["Transfer membership must start on the backend business date."]
                });
            }
        }

        await using var transaction = dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory"
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        if (!preserveSingleVisit && currentMembership is not null)
        {
            currentMembership.ValidTo = now;
            if (currentMembership.BehaviorKind is MembershipBehaviorKind.Term or MembershipBehaviorKind.Professional)
                currentMembership.IndividualValidTo = today.AddDays(-1);
        }

        client.BranchId = targetBranchId;
        client.UpdatedAt = now;
        await CloseActiveBranchAssignmentsAsync(client.Id, now, dbContext, cancellationToken);
        OpenBranchAssignment(client.Id, targetBranchId, currentUser.Id, now, dbContext);

        await ReplaceGroupAssignmentsAsync(
            client.Id,
            targetBranchId,
            targetGroupIds,
            currentUser.Id,
            now,
            dbContext,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        if (!preserveSingleVisit)
        {
            var isPaid = string.Equals(request.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase);
            var mutation = await membershipService.PurchaseAsync(
                client.Id,
                new CreateClientMembershipPurchaseCommand(
                    currentUser.Id,
                    request.MembershipCatalogItemId,
                    ParseIsoDate(request.ValidFrom),
                    ParseIsoDate(request.ValidTo),
                    isPaid,
                    ParseIsoDate(request.PaymentDate),
                    request.ProfessionalComment,
                    request.ManualSaleAmount),
                cancellationToken);
            if (!mutation.Succeeded)
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                }
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["membershipCatalogItemId"] = [$"Transfer membership failed: {mutation.Error}."]
                });
            }
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var updatedClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Transferred client '{client.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.ClientTransferredAction,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                ClientAuditResources.ClientTransferredDescription(
                    currentUser.Login,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
                oldState,
                SerializeAuditState(updatedClient)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(updatedClient, EmptyAttendanceHistoryPage()));
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ArchiveClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateClientStatusAsync(
            id,
            ClientStatus.Archived,
            ClientAuditConstants.ClientArchivedAction,
            ClientAuditResources.ClientArchivedDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> RestoreClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateClientStatusAsync(
            id,
            ClientStatus.Active,
            ClientAuditConstants.ClientRestoredAction,
            ClientAuditResources.ClientRestoredDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientStatusAsync(
        Guid id,
        ClientStatus targetStatus,
        string actionType,
        Func<string, string, string> descriptionFactory,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
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

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var clientBefore = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Client '{id}' was not found after mutation load.");

        if (client.Status == targetStatus)
        {
            return TypedResults.Ok(MapDetails(clientBefore, EmptyAttendanceHistoryPage()));
        }

        var oldState = SerializeAuditState(clientBefore);
        client.Status = targetStatus;
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var clientAfter = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after status change.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                actionType,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                descriptionFactory(
                    currentUser.Login,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
                oldState,
                SerializeAuditState(clientAfter)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(clientAfter, EmptyAttendanceHistoryPage()));
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> PurchaseMembershipAsync(
        Guid id,
        PurchaseClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken,
            validateRequest: _ => ValidatePurchaseMembershipRequest(request),
            executeAsync: currentUser =>
                membershipService.PurchaseAsync(
                    id,
                    new CreateClientMembershipPurchaseCommand(
                        currentUser.Id,
                        request.MembershipCatalogItemId,
                        ParseIsoDate(request.ValidFrom),
                        ParseIsoDate(request.ValidTo),
                        string.Equals(request.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase),
                        ParseIsoDate(request.PaymentDate),
                        request.ProfessionalComment,
                        request.ManualSaleAmount),
                    cancellationToken),
            actionType: ClientAuditConstants.MembershipPurchasedAction,
            descriptionFactory: ClientAuditResources.MembershipPurchasedDescription);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateMembershipCommentAsync(
        Guid id, Guid saleId, UpdateClientMembershipCommentRequest request, HttpContext httpContext,
        GymCrmDbContext dbContext, IClientMembershipService membershipService, IAuditLogService auditLogService,
        ILoggerFactory loggerFactory, IAntiforgery antiforgery, CancellationToken cancellationToken)
    {
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrf is not null) return csrf;
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null) return TypedResults.Unauthorized();
        string? normalized;
        try { normalized = ClientMembershipCommentPolicy.Normalize(request.Comment); }
        catch (ArgumentException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["comment"] = ["Comment must not exceed 2000 characters."] });
        }

        var mutation = await membershipService.UpdateCommentAsync(id, saleId,
            new UpdateClientMembershipCommentCommand(currentUser.Id, normalized), cancellationToken);
        if (!mutation.Found) return TypedResults.NotFound();

        if (mutation.Transition is not null)
        {
            var entry = new AuditLogEntry(currentUser.Id, ClientAuditConstants.MembershipCommentChangedAction,
                ClientAuditConstants.MembershipSaleEntityType, saleId.ToString(),
                ClientAuditResources.MembershipCommentChangedDescription(currentUser.Login),
                NewValueJson: JsonSerializer.Serialize(new { clientId = id, saleId, transition = mutation.Transition }, AuditSerializerOptions));
            await TryWriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, id, entry, cancellationToken);
        }

        var client = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found.");
        return TypedResults.Ok(MapDetails(client, EmptyAttendanceHistoryPage(), loggerFactory.CreateLogger("ClientMembershipCommentMetadata")));
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RenewMembershipAsync(
        Guid id,
        RenewClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken,
            validateRequest: clientBefore => ValidateRenewMembershipRequest(request, clientBefore),
            executeAsync: currentUser =>
                membershipService.RenewAsync(
                    id,
                    new RenewClientMembershipCommand(
                        currentUser.Id,
                        request.MembershipCatalogItemId,
                        string.Equals(request.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase),
                        ParseIsoDate(request.PaymentDate),
                        request.ProfessionalComment,
                        request.ManualSaleAmount),
                    cancellationToken),
            actionType: ClientAuditConstants.MembershipRenewedAction,
            descriptionFactory: ClientAuditResources.MembershipRenewedDescription);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CorrectMembershipAsync(
        Guid id,
        CorrectClientMembershipRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken,
            validateRequest: clientBefore => ValidateCorrectMembershipRequest(request, clientBefore),
            executeAsync: currentUser =>
                membershipService.CorrectAsync(
                    id,
                    new CorrectClientMembershipCommand(
                        currentUser.Id,
                        ParseIsoDate(request.PurchaseDate)!.Value,
                        ParseIsoDate(request.ExpirationDate),
                        request.IsPaid!.Value),
                    cancellationToken),
            actionType: ClientAuditConstants.MembershipCorrectedAction,
            descriptionFactory: ClientAuditResources.MembershipCorrectedDescription);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> MarkMembershipPaymentAsync(
        Guid id,
        MarkMembershipPaymentRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken,
            validateRequest: clientBefore => ValidateMarkMembershipPaymentRequest(request, clientBefore),
            executeAsync: currentUser =>
                membershipService.MarkPaymentAsync(
                    id,
                    new MarkClientMembershipPaymentCommand(currentUser.Id),
                    cancellationToken),
            actionType: ClientAuditConstants.MembershipPaymentMarkedAction,
            descriptionFactory: ClientAuditResources.MembershipPaymentMarkedDescription);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RegisterMembershipRefundAsync(
        Guid id,
        Guid saleId,
        CreateClientMembershipRefundRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
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

        var clientBefore = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = ValidateRefundRequest(request);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var mutationResult = await membershipService.RegisterRefundAsync(
            id,
            new RegisterClientMembershipRefundCommand(
                currentUser.Id,
                saleId,
                ParseIsoDate(request.RefundDate)!.Value,
                request.Amount!.Value,
                NormalizeOptionalText(request.Comment)),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return MapRefundMutationError(mutationResult.Error);
        }

        var clientAfter = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership refund registration.");
        var refund = mutationResult.Refund
            ?? throw new InvalidOperationException("Membership refund mutation succeeded without a refund snapshot.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.MembershipRefundCreatedAction,
                ClientAuditConstants.MembershipRefundEntityType,
                refund.Id.ToString(),
                ClientAuditResources.MembershipRefundCreatedDescription(
                    currentUser.Login,
                    BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                NewValueJson: SerializeRefundAuditState(refund)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(clientAfter, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CancelMembershipRefundAsync(
        Guid id,
        Guid refundId,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
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

        var clientBefore = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var mutationResult = await membershipService.CancelRefundAsync(
            id,
            new CancelClientMembershipRefundCommand(currentUser.Id, refundId),
            cancellationToken);

        if (!mutationResult.Succeeded)
        {
            return MapRefundMutationError(mutationResult.Error);
        }

        var clientAfter = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership refund cancellation.");
        var refund = mutationResult.Refund
            ?? throw new InvalidOperationException("Membership refund cancellation succeeded without a refund snapshot.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.MembershipRefundCanceledAction,
                ClientAuditConstants.MembershipRefundEntityType,
                refund.Id.ToString(),
                ClientAuditResources.MembershipRefundCanceledDescription(
                    currentUser.Login,
                    BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                mutationResult.PreviousRefund is null ? null : SerializeRefundAuditState(mutationResult.PreviousRefund),
                SerializeRefundAuditState(refund)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(clientAfter, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ExecuteMembershipActionAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken,
        Func<Client, Dictionary<string, string[]>> validateRequest,
        Func<User, Task<ClientMembershipMutationResult>> executeAsync,
        string actionType,
        Func<string, string, string> descriptionFactory)
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

        var clientBefore = await LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = validateRequest(clientBefore);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var mutationResult = await executeAsync(currentUser);
        if (!mutationResult.Succeeded)
        {
            if (mutationResult.Error == ClientMembershipMutationError.ClientMissing)
            {
                return TypedResults.NotFound();
            }

            return TypedResults.ValidationProblem(CreateMembershipOperationError(mutationResult.Error));
        }

        var clientAfter = await LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership change.");
        var currentMembershipAfter = GetCurrentMembership(clientAfter);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                actionType,
                ClientAuditConstants.MembershipEntityType,
                currentMembershipAfter?.Id.ToString() ?? clientAfter.Id.ToString(),
                descriptionFactory(
                    currentUser.Login,
                    BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                SerializeMembershipAuditState(GetCurrentMembership(clientBefore)),
                SerializeMembershipAuditState(currentMembershipAfter)),
            cancellationToken);

        if (mutationResult.SaleAudit is not null)
        {
            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    ClientAuditConstants.MembershipSaleCorrectedAction,
                    ClientAuditConstants.MembershipSaleEntityType,
                    mutationResult.SaleAudit.NewSale.Id.ToString(),
                    ClientAuditResources.MembershipSaleCorrectedDescription(
                        currentUser.Login,
                        BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                    SerializeSaleAuditState(mutationResult.SaleAudit.OldSale),
                    SerializeSaleAuditState(mutationResult.SaleAudit.NewSale)),
                cancellationToken);
        }

        return TypedResults.Ok(MapDetails(clientAfter, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Client?> LoadClientSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Branch)
            .Include(client => client.NotesChangedByUser)
            .Include(client => client.Contacts)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.PaidByUser)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.Refunds)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.CommentChangedByUser)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Branch)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Hall)
            .AsSplitQuery()
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
    }

    private static async Task<ClientAttendanceHistoryPageResponse> LoadAttendanceHistoryAsync(
        Guid clientId,
        IReadOnlyCollection<Guid>? allowedGroupIds,
        AttendanceHistoryPaging paging,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => attendance.ClientId == clientId);

        if (allowedGroupIds is { Count: > 0 })
        {
            query = query.Where(attendance => allowedGroupIds.Contains(attendance.GroupId));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(attendance => attendance.TrainingDate)
            .ThenByDescending(attendance => attendance.UpdatedAt)
            .ThenByDescending(attendance => attendance.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Select(attendance => new ClientAttendanceHistoryEntryResponse(
                attendance.Id,
                attendance.TrainingDate,
                attendance.IsPresent,
                attendance.GroupId,
                attendance.Group.Name,
                attendance.Group.TrainingStartTime.ToString("HH\\:mm"),
                attendance.Group.DurationMinutes,
                attendance.Group.Weekdays))
            .ToArrayAsync(cancellationToken);

        return new ClientAttendanceHistoryPageResponse(
            items,
            paging.Skip,
            paging.Take,
            totalCount,
            paging.Skip + items.Length < totalCount);
    }

    private static async Task<Client?> LoadClientForMutationAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .SingleOrDefaultAsync(client => client.Id == id, cancellationToken);
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

    private static ClientAttendanceHistoryPageResponse EmptyAttendanceHistoryPage()
    {
        return new ClientAttendanceHistoryPageResponse([], 0, ClientApiConstants.DefaultTake, 0, false);
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

        if (!string.IsNullOrWhiteSpace(paymentStatus) && ParsePaymentStatus(paymentStatus) is null)
        {
            errors["paymentStatus"] = [ClientResources.InvalidPaymentStatus];
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
        Guid currentUserId,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        var withoutMembershipCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.WithoutMembership],
                hasElevatedClientAccess,
                currentUserId,
                today)
            .CountAsync(cancellationToken);
        var expiringSoonCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.ExpiringSoon],
                hasElevatedClientAccess,
                currentUserId,
                today)
            .CountAsync(cancellationToken);
        var withoutGroupCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.WithoutGroup],
                hasElevatedClientAccess,
                currentUserId,
                today)
            .CountAsync(cancellationToken);
        var trialCount = await ApplyQuickFilters(
                baseQuery,
                [ClientQuickFilter.Trial],
                hasElevatedClientAccess,
                currentUserId,
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
        Guid currentUserId,
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
             client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership =>
                    membership.IndividualValidTo.HasValue &&
                    membership.IndividualValidTo.Value < expiresBefore)) ||
            (withoutGroup &&
             !client.Groups.Any(clientGroup =>
                 hasElevatedClientAccess ||
                 clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == currentUserId))) ||
            (trial &&
             client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.BehaviorKind == MembershipBehaviorKind.SingleVisit)));
    }

    private static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedClientRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken,
        Guid? currentBranchId = null)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            errors["phone"] = [ClientResources.PhoneRequired];
        }
        else if (request.Phone.Length > 32)
        {
            errors["phone"] = [ClientResources.PhoneTooLong];
        }

        if (request.Notes is not null && request.Notes.Length > ClientApiConstants.NotesMaxLength)
        {
            errors["notes"] = [ClientResources.NotesTooLong];
        }

        ValidateNamePart(request.LastName, "lastName", ClientResources.LastNameTooLong, errors);
        ValidateNamePart(request.FirstName, "firstName", ClientResources.FirstNameTooLong, errors);
        ValidateNamePart(request.MiddleName, "middleName", ClientResources.MiddleNameTooLong, errors);

        if (string.IsNullOrWhiteSpace(request.LastName) &&
            string.IsNullOrWhiteSpace(request.FirstName) &&
            string.IsNullOrWhiteSpace(request.MiddleName))
        {
            errors["fullName"] = [ClientResources.FullNameRequired];
        }

        await ValidateClientBranchAsync(request.BranchId, currentBranchId, errors, dbContext, cancellationToken);

        if (request.RawContacts?.Count > 2)
        {
            errors["contacts"] = [ClientResources.ContactsLimitExceeded];
        }

        for (var index = 0; index < request.Contacts.Count; index++)
        {
            var contact = request.Contacts[index];
            if (string.IsNullOrWhiteSpace(contact.Type))
            {
                errors[$"contacts[{index}].type"] = [ClientResources.ContactTypeRequired];
            }
            else if (contact.Type.Length > 64)
            {
                errors[$"contacts[{index}].type"] = [ClientResources.ContactTypeTooLong];
            }

            if (string.IsNullOrWhiteSpace(contact.FullName))
            {
                errors[$"contacts[{index}].fullName"] = [ClientResources.ContactFullNameRequired];
            }
            else if (contact.FullName.Length > 256)
            {
                errors[$"contacts[{index}].fullName"] = [ClientResources.ContactFullNameTooLong];
            }

            if (string.IsNullOrWhiteSpace(contact.Phone))
            {
                errors[$"contacts[{index}].phone"] = [ClientResources.ContactPhoneRequired];
            }
            else if (contact.Phone.Length > 32)
            {
                errors[$"contacts[{index}].phone"] = [ClientResources.ContactPhoneTooLong];
            }
        }

        if (request.RawGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = [ClientResources.InvalidGroupId];
            return errors;
        }

        if (request.GroupIds.Count == 0)
        {
            errors["groupIds"] = [ClientResources.ClientGroupsRequired];
        }

        if (request.GroupIds.Count == 0 || errors.ContainsKey("branchId"))
        {
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustExist];
            return errors;
        }

        var sameBranchGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id) && group.BranchId == request.BranchId!.Value)
            .CountAsync(cancellationToken);

        if (sameBranchGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustBelongToClientBranch];
        }

        return errors;
    }

    private static async Task ValidateClientBranchAsync(
        Guid? requestedBranchId,
        Guid? currentBranchId,
        Dictionary<string, string[]> errors,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!requestedBranchId.HasValue)
        {
            errors["branchId"] = [ClientResources.BranchRequired];
            return;
        }

        if (requestedBranchId.Value == Guid.Empty)
        {
            errors["branchId"] = [ClientResources.InvalidBranchId];
            return;
        }

        if (currentBranchId.HasValue && requestedBranchId.Value != currentBranchId.Value)
        {
            errors["branchId"] = [ClientResources.BranchTransferRequired];
            return;
        }

        var branch = await dbContext.Branches
            .AsNoTracking()
            .Where(candidate => candidate.Id == requestedBranchId.Value)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IsArchived
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (branch is null)
        {
            errors["branchId"] = [ClientResources.BranchMustExist];
        }
        else if (branch.IsArchived)
        {
            errors["branchId"] = [ClientResources.BranchMustBeActive];
        }
    }

    private static async Task<Dictionary<string, string[]>> ValidateTransferRequestAsync(
        TransferClientBranchRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        var groupIds = NormalizeTransferGroupIds(request);

        var targetBranchId = request.TargetBranchId ?? request.BranchId;
        await ValidateClientBranchAsync(targetBranchId, currentBranchId: null, errors, dbContext, cancellationToken);
        if (request.GroupId == Guid.Empty || request.GroupIds?.Any(groupId => groupId == Guid.Empty) == true ||
            request.TargetGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = [ClientResources.InvalidGroupId];
        }

        if (groupIds.Count == 0)
        {
            errors["groupIds"] = [ClientResources.ClientGroupsRequired];
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => groupIds.Contains(candidate.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != groupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustExist];
            return errors;
        }

        var sameBranchGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(candidate => groupIds.Contains(candidate.Id) && candidate.BranchId == targetBranchId!.Value)
            .CountAsync(cancellationToken);

        if (sameBranchGroupCount != groupIds.Count)
        {
            errors["groupIds"] = [ClientResources.TransferGroupMustBelongToTargetBranch];
        }

        return errors;
    }

    private static NormalizedClientRequest NormalizeRequest(UpsertClientRequest request)
    {
        return new NormalizedClientRequest(
            NormalizeOptionalText(request.LastName),
            NormalizeOptionalText(request.FirstName),
            NormalizeOptionalText(request.MiddleName),
            request.Phone?.Trim() ?? string.Empty,
            request.BranchId,
            NormalizeOptionalText(request.Notes),
            request.Contacts,
            NormalizeContacts(request.Contacts),
            request.GroupIds,
            NormalizeGroupIds(request.GroupIds));
    }

    private static IReadOnlyList<NormalizedClientContactRequest> NormalizeContacts(
        IReadOnlyList<UpsertClientContactRequest>? contacts)
    {
        if (contacts is null)
        {
            return [];
        }

        return contacts
            .Select(contact => new NormalizedClientContactRequest(
                contact.Type?.Trim() ?? string.Empty,
                contact.FullName?.Trim() ?? string.Empty,
                contact.Phone?.Trim() ?? string.Empty))
            .ToArray();
    }

    private static IReadOnlyList<Guid> NormalizeGroupIds(IReadOnlyList<Guid>? groupIds)
    {
        return groupIds?
            .Where(groupId => groupId != Guid.Empty)
            .Distinct()
            .OrderBy(groupId => groupId)
            .ToArray() ?? [];
    }

    private static IReadOnlyList<Guid> NormalizeTransferGroupIds(TransferClientBranchRequest request)
    {
        var groupIds = request.TargetGroupIds is { Count: > 0 }
            ? request.TargetGroupIds
            : request.GroupIds is { Count: > 0 }
                ? request.GroupIds
            : request.GroupId.HasValue
                ? [request.GroupId.Value]
                : [];

        return groupIds
            .Where(groupId => groupId != Guid.Empty)
            .Distinct()
            .OrderBy(groupId => groupId)
            .ToArray();
    }

    private static async Task ReplaceContactsAsync(
        Guid clientId,
        IReadOnlyList<NormalizedClientContactRequest> requestedContacts,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var existingContacts = await dbContext.ClientContacts
            .Where(contact => contact.ClientId == clientId)
            .ToArrayAsync(cancellationToken);

        if (existingContacts.Length > 0)
        {
            dbContext.ClientContacts.RemoveRange(existingContacts);
        }

        foreach (var requestedContact in requestedContacts)
        {
            dbContext.ClientContacts.Add(new ClientContact
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                Type = requestedContact.Type,
                FullName = requestedContact.FullName,
                Phone = requestedContact.Phone
            });
        }
    }

    private static async Task ReplaceGroupAssignmentsAsync(
        Guid clientId,
        Guid branchId,
        IReadOnlyList<Guid> requestedGroupIds,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requested = requestedGroupIds.ToHashSet();
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);

        var existingGroups = await dbContext.ClientGroups
            .Where(clientGroup => clientGroup.ClientId == clientId)
            .ToArrayAsync(cancellationToken);
        var activeAssignments = await dbContext.ClientGroupAssignments
            .Where(assignment => assignment.ClientId == clientId && assignment.ValidTo == null)
            .ToArrayAsync(cancellationToken);

        var groupsToRemove = existingGroups
            .Where(clientGroup => !requested.Contains(clientGroup.GroupId))
            .ToArray();

        if (groupsToRemove.Length > 0)
        {
            dbContext.ClientGroups.RemoveRange(groupsToRemove);
        }

        foreach (var assignment in activeAssignments.Where(assignment => !requested.Contains(assignment.GroupId)))
        {
            CloseOrRemovePeriod(assignment, today, dbContext.ClientGroupAssignments);
        }

        var existingGroupIds = existingGroups
            .Select(clientGroup => clientGroup.GroupId)
            .ToHashSet();
        var activeAssignmentGroupIds = activeAssignments
            .Where(assignment => requested.Contains(assignment.GroupId))
            .Select(assignment => assignment.GroupId)
            .ToHashSet();

        foreach (var groupId in requestedGroupIds)
        {
            if (existingGroupIds.Contains(groupId))
            {
                continue;
            }

            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientId,
                GroupId = groupId,
                BranchId = branchId
            });
        }

        foreach (var groupId in requestedGroupIds.Where(groupId => !activeAssignmentGroupIds.Contains(groupId)))
        {
            dbContext.ClientGroupAssignments.Add(new ClientGroupAssignment
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                GroupId = groupId,
                ValidFrom = today,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            });
        }
    }

    private static void OpenBranchAssignment(
        Guid clientId,
        Guid branchId,
        Guid changedByUserId,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        dbContext.ClientBranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BranchId = branchId,
            ValidFrom = DateOnly.FromDateTime(now.UtcDateTime.Date),
            CreatedByUserId = changedByUserId,
            CreatedAt = now
        });
    }

    private static async Task CloseActiveBranchAssignmentsAsync(
        Guid clientId,
        DateTimeOffset now,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(now.UtcDateTime.Date);
        var activeAssignments = await dbContext.ClientBranchAssignments
            .Where(assignment => assignment.ClientId == clientId && assignment.ValidTo == null)
            .ToArrayAsync(cancellationToken);

        foreach (var assignment in activeAssignments)
        {
            CloseOrRemovePeriod(assignment, today, dbContext.ClientBranchAssignments);
        }
    }

    private static void CloseOrRemovePeriod(ClientBranchAssignment assignment, DateOnly validTo, DbSet<ClientBranchAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }

    private static void CloseOrRemovePeriod(ClientGroupAssignment assignment, DateOnly validTo, DbSet<ClientGroupAssignment> assignments)
    {
        if (assignment.ValidFrom >= validTo)
        {
            assignments.Remove(assignment);
            return;
        }

        assignment.ValidTo = validTo;
    }

    private static Dictionary<string, string[]> ValidatePurchaseMembershipRequest(PurchaseClientMembershipRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        _ = ValidateOptionalDate(request.ValidFrom, "validFrom", errors);
        _ = ValidateOptionalDate(request.ValidTo, "validTo", errors);
        ValidateCatalogPayment(request.PaymentStatus, request.PaymentDate, errors);

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRenewMembershipRequest(
        RenewClientMembershipRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        if (GetCurrentMembership(client) is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForRenewal];
            return errors;
        }

        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        ValidateCatalogPayment(request.PaymentStatus, request.PaymentDate, errors);

        return errors;
    }

    private static void ValidateCatalogPayment(string? status, string? paymentDate, Dictionary<string, string[]> errors)
    {
        if (status is not ("Paid" or "Unpaid"))
            errors["paymentStatus"] = ["Payment status must be Paid or Unpaid."];
        var date = ValidateOptionalDate(paymentDate, "paymentDate", errors);
        if (status == "Paid" && !date.HasValue) errors["paymentDate"] = ["Payment date is required for paid membership."];
        if (status == "Unpaid" && date.HasValue) errors["paymentDate"] = ["Payment date must be absent for unpaid membership."];
    }

    private static void ValidatePricingSelection(
        Guid? membershipCatalogItemId,
        decimal? manualSaleAmount,
        Dictionary<string, string[]> errors)
    {
        if (membershipCatalogItemId == Guid.Empty)
        {
            errors["membershipCatalogItemId"] = ["Membership catalog item id is invalid."];
        }

        if (!membershipCatalogItemId.HasValue && !manualSaleAmount.HasValue)
        {
            const string message = "Choose a catalog item or provide a manual sale amount.";
            errors["membershipCatalogItemId"] = [message];
            errors["manualSaleAmount"] = [message];
            return;
        }

        if (manualSaleAmount.HasValue &&
            !RubMoneyPolicy.IsWholeAmount(manualSaleAmount.Value, allowZero: false))
        {
            errors["manualSaleAmount"] =
                ["Manual sale amount must be a positive whole number of RUB within the supported range."];
        }
    }

    private static void ValidateAdditionalFields(
        IDictionary<string, JsonElement>? additionalFields,
        Dictionary<string, string[]> errors)
    {
        if (additionalFields is null)
        {
            return;
        }

        foreach (var field in additionalFields.Keys)
        {
            errors[field] = [$"Field '{field}' is not allowed for this operation."];
        }
    }

    private static Dictionary<string, string[]> ValidateCorrectMembershipRequest(
        CorrectClientMembershipRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        var currentMembership = GetCurrentMembership(client);
        if (currentMembership is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForCorrection];
            return errors;
        }

        var purchaseDate = ValidateRequiredDate(request.PurchaseDate, "purchaseDate", ClientResources.PurchaseDateRequired, errors);
        var expirationDate = ValidateOptionalDate(request.ExpirationDate, "expirationDate", errors);
        ValidateIsPaidRequired(request.IsPaid, errors);
        if (purchaseDate.HasValue && expirationDate.HasValue && expirationDate < purchaseDate)
            errors["expirationDate"] = [ClientResources.ExpirationBeforePurchaseDate];

        return errors;
    }

    private static Dictionary<string, string[]> ValidateMarkMembershipPaymentRequest(
        MarkMembershipPaymentRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        var currentMembership = GetCurrentMembership(client);
        if (currentMembership is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForPaymentMark];
            return errors;
        }

        if (currentMembership.IsPaid)
        {
            errors["isPaid"] = [ClientResources.CurrentMembershipAlreadyPaid];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRefundRequest(CreateClientMembershipRefundRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (!request.Amount.HasValue)
        {
            errors["amount"] = [ClientResources.RefundAmountRequired];
        }
        else if (!RubMoneyPolicy.IsWholeAmount(request.Amount.Value, allowZero: false))
        {
            errors["amount"] = ["Refund amount must be a positive whole number of RUB within the supported range."];
        }

        ValidateRequiredDate(request.RefundDate, "refundDate", ClientResources.RefundDateRequired, errors);

        var comment = NormalizeOptionalText(request.Comment);
        if (comment is not null && comment.Length > ClientMembershipRefund.CommentMaxLength)
        {
            errors["comment"] = [ClientResources.RefundCommentTooLong];
        }

        return errors;
    }

    private static void ValidateMembershipDateRange(
        MembershipBehaviorKind? behaviorKind,
        DateOnly? purchaseDate,
        DateOnly? expirationDate,
        Dictionary<string, string[]> errors,
        string expirationDateKey)
    {
        if (behaviorKind is MembershipBehaviorKind.SingleVisit || !purchaseDate.HasValue || !expirationDate.HasValue)
        {
            return;
        }

        if (expirationDate.Value < purchaseDate.Value)
        {
            errors[expirationDateKey] = [ClientResources.ExpirationBeforePurchaseDate];
        }
    }

    private static MembershipBehaviorKind? ValidateRequiredBehaviorKind(
        string? behaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            errors["behaviorKind"] = [ClientResources.BehaviorKindRequired];
            return null;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
        }

        return parsedBehaviorKind;
    }

    private static void ValidateOptionalMatchingBehaviorKind(
        string? behaviorKind,
        MembershipBehaviorKind expectedBehaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            return;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
            return;
        }

        if (parsedBehaviorKind.Value != expectedBehaviorKind)
        {
            errors["behaviorKind"] = [ClientResources.CurrentBehaviorKindMismatch(expectedBehaviorKind.ToString())];
        }
    }

    private static DateOnly? ValidateRequiredDate(
        string? value,
        string key,
        string requiredMessage,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[key] = [requiredMessage];
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static DateOnly? ValidateOptionalDate(
        string? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static void ValidateIsPaidRequired(
        bool? isPaid,
        Dictionary<string, string[]> errors)
    {
        if (!isPaid.HasValue)
        {
            errors["isPaid"] = [ClientResources.IsPaidRequired];
        }
    }

    private static MembershipBehaviorKind? ParseBehaviorKind(string? behaviorKind)
    {
        return Enum.TryParse<MembershipBehaviorKind>(behaviorKind?.Trim(), ignoreCase: true, out var parsedBehaviorKind)
            ? parsedBehaviorKind
            : null;
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

    private static Dictionary<string, string[]> CreateMembershipOperationError(ClientMembershipMutationError error)
    {
        return error switch
        {
            ClientMembershipMutationError.InvalidRequest => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.InvalidMembershipChangeRequest]
            },
            ClientMembershipMutationError.CurrentMembershipMissing => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipMissingForAction]
            },
            ClientMembershipMutationError.CurrentMembershipAlreadyPaid => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipAlreadyPaid]
            },
            ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund => new Dictionary<string, string[]>
            {
                ["purchaseDate"] = [ClientResources.CorrectedPurchaseDateAfterRefund]
            },
            ClientMembershipMutationError.PricingSelectionMissing => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Choose a catalog item or provide a manual sale amount."],
                ["manualSaleAmount"] = ["Choose a catalog item or provide a manual sale amount."]
            },
            ClientMembershipMutationError.ManualSaleAmountInvalid => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Manual sale amount must be a positive whole number of RUB within the supported range."]
            },
            ClientMembershipMutationError.ProfessionalOverrideNotAllowed => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Professional membership can only use its zero catalog price."]
            },
            ClientMembershipMutationError.ProfessionalPermissionDenied => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Only HeadCoach can assign Professional membership."]
            },
            ClientMembershipMutationError.CatalogItemMissing or
            ClientMembershipMutationError.CatalogItemBranchMismatch or
            ClientMembershipMutationError.CatalogItemUnavailable => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Selected membership catalog item is not available for this client."]
            },
            _ => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.MembershipChangeFailed]
            }
        };
    }

    private static Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> MapRefundMutationError(
        ClientMembershipRefundMutationError error)
    {
        if (error == ClientMembershipRefundMutationError.ClientMissing)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.ValidationProblem(error switch
        {
            ClientMembershipRefundMutationError.SaleMissing => new Dictionary<string, string[]>
            {
                ["saleId"] = [ClientResources.SaleMustExist]
            },
            ClientMembershipRefundMutationError.RefundMissing => new Dictionary<string, string[]>
            {
                ["refundId"] = [ClientResources.RefundMustExist]
            },
            ClientMembershipRefundMutationError.RefundAmountExceedsGrossAmount => new Dictionary<string, string[]>
            {
                ["amount"] = [ClientResources.RefundAmountExceedsGrossAmount]
            },
            ClientMembershipRefundMutationError.RefundDateInFuture => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateInFuture]
            },
            ClientMembershipRefundMutationError.RefundDateBeforePurchaseDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforePurchaseDate]
            },
            ClientMembershipRefundMutationError.RefundDateBeforeSaleCreatedDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforeSaleCreatedDate]
            },
            ClientMembershipRefundMutationError.RefundAlreadyCanceled => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.RefundAlreadyCanceled]
            },
            _ => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.InvalidMembershipChangeRequest]
            }
        });
    }

    private static void ValidateNamePart(
        string? value,
        string key,
        string message,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Length > 128)
        {
            errors[key] = [message];
        }
    }

    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static IQueryable<Client> ApplyCoachClientScope(
        IQueryable<Client> query,
        Guid trainerId,
        GymCrmDbContext dbContext)
    {
        var assignedClientIds = dbContext.ClientGroups
            .Where(clientGroup => dbContext.GroupTrainers.Any(
                groupTrainer =>
                    groupTrainer.GroupId == clientGroup.GroupId &&
                    groupTrainer.TrainerId == trainerId))
            .Select(clientGroup => clientGroup.ClientId);

        return query.Where(client => assignedClientIds.Contains(client.Id));
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

        return query.Where(client => client.Memberships
            .Where(membership => membership.ValidTo == null)
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .Take(1)
            .Any(membership =>
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
                !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) &&
                !client.Memberships.Any(membership => membership.ValidTo == null)),
            ClientMembershipState.Unpaid => query.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => !membership.IsPaid)),
            ClientMembershipState.Expired => query.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.IsPaid && membership.IndividualValidTo != null && membership.IndividualValidTo < today)),
            ClientMembershipState.UsedSingleVisit => query.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) && client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.IsPaid && membership.BehaviorKind == MembershipBehaviorKind.SingleVisit && membership.SingleVisitUsed)),
            ClientMembershipState.ActivePaid => query.Where(client => client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)) || client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(
                    membership =>
                        membership.IsPaid &&
                        (membership.IndividualValidTo == null || membership.IndividualValidTo >= today) &&
                        (membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed))),
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

    private static ClientPaymentStatus? ParsePaymentStatus(string? paymentStatus)
    {
        return Enum.TryParse<ClientPaymentStatus>(paymentStatus?.Trim(), ignoreCase: true, out var parsedPaymentStatus)
            ? parsedPaymentStatus
            : null;
    }

    private static ClientMembershipState? ParseMembershipState(string? membershipState)
    {
        return Enum.TryParse<ClientMembershipState>(membershipState?.Trim(), ignoreCase: true, out var parsedMembershipState)
            ? parsedMembershipState
            : null;
    }

    private static ClientListItemResponse MapListItem(Client client, User currentUser)
    {
        return currentUser.Role == UserRole.Coach
            ? MapCoachListItem(client, currentUser.Id)
            : MapManagerListItem(client);
    }

    private static async Task<IReadOnlyList<ClientListItemResponse>> HydrateClientListItemsAsync(
        IReadOnlyList<ClientListItemResponse> items,
        bool hasElevatedClientAccess,
        Guid currentUserId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return items;
        }

        var clientIds = items.Select(item => item.Id).ToArray();
        var currentMemberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Where(membership => clientIds.Contains(membership.ClientId) && membership.ValidTo == null)
            .ToArrayAsync(cancellationToken);
        var currentMembershipByClientId = currentMemberships
            .GroupBy(membership => membership.ClientId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .First());

        var attendanceQuery = dbContext.Attendance
            .AsNoTracking()
            .Where(attendance => clientIds.Contains(attendance.ClientId) && attendance.IsPresent);

        if (!hasElevatedClientAccess)
        {
            var coachGroupIds = await dbContext.GroupTrainers
                .AsNoTracking()
                .Where(groupTrainer => groupTrainer.TrainerId == currentUserId)
                .Select(groupTrainer => groupTrainer.GroupId)
                .ToArrayAsync(cancellationToken);

            attendanceQuery = attendanceQuery.Where(attendance => coachGroupIds.Contains(attendance.GroupId));
        }

        var lastVisits = await attendanceQuery
            .GroupBy(attendance => attendance.ClientId)
            .Select(group => new ClientLastVisitProjection(
                group.Key,
                group.Max(attendance => attendance.TrainingDate)))
            .ToArrayAsync(cancellationToken);
        var lastVisitByClientId = lastVisits.ToDictionary(
            lastVisit => lastVisit.ClientId,
            lastVisit => (DateOnly?)lastVisit.TrainingDate);

        return items
            .Select(item =>
            {
                currentMembershipByClientId.TryGetValue(item.Id, out var currentMembership);
                lastVisitByClientId.TryGetValue(item.Id, out var lastVisitDate);

                return item with
                {
                    HasActivePaidMembership = HasActivePaidMembership(item.IsProfessional, currentMembership),
                    HasUnpaidCurrentMembership = HasUnpaidCurrentMembership(item.IsProfessional, currentMembership),
                    CurrentMembershipSummary = MapCurrentMembershipSummary(currentMembership),
                    HasCurrentMembership = currentMembership is not null,
                    MembershipState = GetMembershipState(item.IsProfessional, currentMembership).ToString(),
                    LastVisitDate = lastVisitDate,
                    ActionHints = BuildActionHints(
                        item.IsProfessional,
                        item.ProfessionalComment,
                        currentMembership,
                        item.Groups.Count)
                };
            })
            .ToArray();
    }

    private static ClientListItemResponse MapManagerListItem(Client client)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var groups = MapGroups(client.Groups);
        var currentMembership = GetCurrentMembership(client);

        return new ClientListItemResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.BranchId,
            client.Branch.Name,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            client.Contacts.Count,
            MapPhoto(client),
            client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)),
            client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(),
            HasActivePaidMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            HasUnpaidCurrentMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            MapCurrentMembershipSummary(currentMembership),
            currentMembership is not null,
            GetMembershipState(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership).ToString(),
            client.AttendanceEntries
                .Where(attendance => attendance.IsPresent)
                .OrderByDescending(attendance => attendance.TrainingDate)
                .ThenByDescending(attendance => attendance.UpdatedAt)
                .Select(attendance => (DateOnly?)attendance.TrainingDate)
                .FirstOrDefault(),
            BuildActionHints(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(), currentMembership, groups.Count),
            client.UpdatedAt);
    }

    private static ClientListItemResponse MapCoachListItem(Client client, Guid coachId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var coachGroups = client.Groups
            .Where(clientGroup => clientGroup.Group.Trainers.Any(trainer => trainer.TrainerId == coachId))
            .ToArray();
        var groups = MapGroups(coachGroups);
        var currentMembership = GetCurrentMembership(client);

        return new ClientListItemResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            string.Empty,
            client.BranchId,
            client.Branch.Name,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            0,
            MapPhoto(client),
            client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)),
            client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(),
            HasActivePaidMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            HasUnpaidCurrentMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            MapCurrentMembershipSummary(currentMembership),
            currentMembership is not null,
            GetMembershipState(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership).ToString(),
            client.AttendanceEntries
                .Where(attendance =>
                    attendance.IsPresent &&
                    coachGroups.Select(group => group.GroupId).Contains(attendance.GroupId))
                .OrderByDescending(attendance => attendance.TrainingDate)
                .ThenByDescending(attendance => attendance.UpdatedAt)
                .Select(attendance => (DateOnly?)attendance.TrainingDate)
                .FirstOrDefault(),
            BuildActionHints(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(), currentMembership, groups.Count),
            client.UpdatedAt);
    }

    private static ClientDetailsResponse MapDetails(
        Client client,
        ClientAttendanceHistoryPageResponse attendanceHistory,
        ILogger? logger = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var groups = MapGroups(client.Groups);
        var contacts = client.Contacts
            .Select(contact => new ClientContactResponse(
                contact.Type,
                contact.FullName,
                contact.Phone))
            .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
            .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
            .ToArray();
        var membershipHistory = MapMembershipHistory(client.Memberships, logger);
        var currentMembership = GetCurrentMembership(client);
        var notesMetadata = ResolveNotesMetadata(client, logger);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.BranchId,
            client.Branch.Name,
            client.Notes,
            notesMetadata.Name,
            notesMetadata.ChangedAt,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            contacts,
            MapPhoto(client),
            client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)),
            client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(),
            HasActivePaidMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            HasUnpaidCurrentMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            currentMembership is null ? null : MapMembership(currentMembership, logger),
            BuildActionHints(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(), currentMembership, groups.Count),
            membershipHistory,
            attendanceHistory.Items,
            attendanceHistory.Skip,
            attendanceHistory.Take,
            attendanceHistory.TotalCount,
            attendanceHistory.HasMore,
            client.CreatedAt,
            client.UpdatedAt);
    }

    private static ClientDetailsResponse MapCoachDetails(
        Client client,
        IReadOnlyCollection<ClientGroup> coachGroups,
        ClientAttendanceHistoryPageResponse attendanceHistory,
        ILogger? logger = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var groups = MapGroups(coachGroups);
        var currentMembership = GetCurrentMembership(client);
        var notesMetadata = ResolveNotesMetadata(client, logger);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            string.Empty,
            client.BranchId,
            client.Branch.Name,
            client.Notes,
            notesMetadata.Name,
            notesMetadata.ChangedAt,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            [],
            MapPhoto(client),
            client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)),
            client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(),
            HasActivePaidMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            HasUnpaidCurrentMembership(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), currentMembership),
            null,
            BuildActionHints(client.Memberships.Any(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)), client.Memberships.Where(membership => membership.ValidTo == null && membership.BehaviorKind == MembershipBehaviorKind.Professional && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo.Value >= today)).Select(membership => membership.ProfessionalComment).FirstOrDefault(), currentMembership, groups.Count),
            [],
            attendanceHistory.Items,
            attendanceHistory.Skip,
            attendanceHistory.Take,
            attendanceHistory.TotalCount,
            attendanceHistory.HasMore,
            client.CreatedAt,
            client.UpdatedAt);
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

    private static IReadOnlyList<ClientMembershipResponse> MapMembershipHistory(ICollection<ClientMembership> memberships, ILogger? logger = null)
    {
        return memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .Select(membership => MapMembership(membership, logger))
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

    private static ClientMembershipResponse MapMembership(ClientMembership membership, ILogger? logger = null)
    {
        var commentMetadata = ResolveMembershipCommentMetadata(membership.Sale, logger);
        return new ClientMembershipResponse(
            membership.Id,
            membership.SaleId,
            membership.Sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
            membership.BehaviorKind.ToString(),
            membership.Sale.PricingMode.ToString(),
            membership.Sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
            membership.Sale.PurchaseDate,
            membership.IndividualValidTo,
            membership.IndividualValidFrom,
            membership.IndividualValidTo,
            membership.ProfessionalComment,
            membership.IsPaid,
            membership.SingleVisitUsed,
            membership.PaidByUserId,
            membership.PaidByUser?.FullName,
            membership.PaidAt,
            membership.ChangeReason.ToString(),
            membership.ValidFrom,
            membership.ValidTo,
            membership.CreatedAt,
            membership.Sale.Comment,
            commentMetadata.Name,
            commentMetadata.ChangedAt,
            MapFinancialSummary(membership.Sale),
            MapRefunds(membership.Sale));
    }

    private static (string? Name, DateTimeOffset? ChangedAt) ResolveMembershipCommentMetadata(ClientMembershipSale sale, ILogger? logger)
    {
        if (sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null)
            return (sale.CommentChangedByUser.FullName, sale.CommentChangedAt);

        if (sale.CommentChangedByUserId.HasValue || sale.CommentChangedAt.HasValue)
        {
            logger?.LogWarning(
                "Membership comment metadata is incomplete or its author cannot be resolved. SaleId={SaleId} HasActorId={HasActorId} HasChangedAt={HasChangedAt} HasResolvedActor={HasResolvedActor}",
                sale.Id,
                sale.CommentChangedByUserId.HasValue,
                sale.CommentChangedAt.HasValue,
                sale.CommentChangedByUser is not null);
        }
        return (null, null);
    }

    private static ClientMembershipFinancialSummaryResponse MapFinancialSummary(ClientMembershipSale sale)
    {
        var nonCanceledRefunds = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .ToArray();
        var refundedAmount = nonCanceledRefunds.Sum(refund => refund.Amount);
        var refundStatus = refundedAmount <= 0
            ? ClientMembershipRefundStatus.None
            : refundedAmount >= sale.GrossAmount
                ? ClientMembershipRefundStatus.Full
                : ClientMembershipRefundStatus.Partial;

        return new ClientMembershipFinancialSummaryResponse(
            sale.GrossAmount,
            refundedAmount,
            sale.GrossAmount - refundedAmount,
            refundStatus.ToString(),
            nonCanceledRefunds
                .Select(refund => (DateOnly?)refund.RefundDate)
                .OrderByDescending(refundDate => refundDate)
                .FirstOrDefault());
    }

    private static IReadOnlyList<ClientMembershipRefundResponse> MapRefunds(ClientMembershipSale sale)
    {
        return sale.Refunds
            .OrderByDescending(refund => refund.RefundDate)
            .ThenByDescending(refund => refund.CreatedAt)
            .ThenByDescending(refund => refund.Id)
            .Select(refund => new ClientMembershipRefundResponse(
                refund.Id,
                refund.SaleId,
                refund.ClientId,
                refund.Amount,
                refund.RefundDate,
                refund.Comment,
                refund.CreatedByUserId,
                refund.CreatedAt,
                refund.CanceledAt,
                refund.CanceledByUserId))
            .ToArray();
    }

    private static CurrentMembershipSummaryResponse? MapCurrentMembershipSummary(ClientMembership? membership)
    {
        return membership is null
            ? null
            : new CurrentMembershipSummaryResponse(
                membership.Id,
                membership.Sale.MembershipCatalogItemId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind.ToString(),
                membership.Sale.PricingMode.ToString(),
                membership.Sale.GrossAmount,
                ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
                membership.Sale.PurchaseDate,
                membership.IndividualValidTo,
                membership.IsPaid,
                membership.SingleVisitUsed);
    }

    private static ClientMembership? GetCurrentMembership(Client client)
    {
        return client.Memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .FirstOrDefault(membership => membership.ValidTo is null);
    }

    private static bool HasActivePaidMembership(bool isProfessional, ClientMembership? membership)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        return ClientMembershipSemantics.HasActivePaidMembership(isProfessional, membership, today);
    }

    private static bool HasUnpaidCurrentMembership(bool isProfessional, ClientMembership? membership)
    {
        return ClientMembershipSemantics.HasUnpaidCurrentMembership(isProfessional, membership);
    }

    private static ClientMembershipState GetMembershipState(bool isProfessional, ClientMembership? membership)
    {
        if (isProfessional)
        {
            return ClientMembershipState.ActivePaid;
        }

        if (membership is null)
        {
            return ClientMembershipState.None;
        }

        if (!membership.IsPaid)
        {
            return ClientMembershipState.Unpaid;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (membership.IndividualValidTo.HasValue && membership.IndividualValidTo.Value < today)
        {
            return ClientMembershipState.Expired;
        }

        if (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit && membership.SingleVisitUsed)
        {
            return ClientMembershipState.UsedSingleVisit;
        }

        return ClientMembershipState.ActivePaid;
    }

    private static IReadOnlyList<ClientActionHintResponse> BuildActionHints(
        bool isProfessional,
        string? professionalComment,
        ClientMembership? currentMembership,
        int visibleGroupCount)
    {
        var hints = new List<ClientActionHintResponse>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        if (isProfessional)
        {
            hints.Add(new ClientActionHintResponse(
                "Плановое сопровождение",
                string.IsNullOrWhiteSpace(professionalComment)
                    ? "Льготный оплаченный статус"
                    : professionalComment,
                "blue",
                "info",
                null));

            if (visibleGroupCount == 0)
            {
                hints.Add(new ClientActionHintResponse(
                    "Назначить группу",
                    "Клиент пока без группы",
                    "blue",
                    "group",
                    null));
            }

            return hints;
        }

        if (currentMembership is null)
        {
            hints.Add(new ClientActionHintResponse(
                "Оформить абонемент",
                "Нет текущего абонемента",
                "orange",
                "membership",
                null));
        }
        else
        {
            if (!currentMembership.IsPaid)
            {
                hints.Add(new ClientActionHintResponse(
                    "Проверить оплату",
                    "Текущий абонемент не оплачен",
                    "red",
                    "payment",
                    null));
            }

            if (currentMembership.IndividualValidTo.HasValue)
            {
                var daysUntilExpiration = currentMembership.IndividualValidTo.Value.DayNumber - today.DayNumber;

                if (daysUntilExpiration < 0)
                {
                    hints.Add(new ClientActionHintResponse(
                        "Продлить абонемент",
                        "Абонемент просрочен",
                        "orange",
                        "membership",
                        daysUntilExpiration));
                }
                else if (daysUntilExpiration < ClientMembershipQueryConstants.ExpiringMembershipWindowDays)
                {
                    hints.Add(new ClientActionHintResponse(
                        "Продлить абонемент",
                        daysUntilExpiration == 0
                            ? "Абонемент заканчивается сегодня"
                            : $"Осталось {daysUntilExpiration} дн.",
                        "yellow",
                        "membership",
                        daysUntilExpiration));
                }
            }

            if (currentMembership is { BehaviorKind: MembershipBehaviorKind.SingleVisit, SingleVisitUsed: true })
            {
                hints.Add(new ClientActionHintResponse(
                    "Оформить абонемент",
                    "Пробное посещение уже использовано",
                    "orange",
                    "membership",
                    null));
            }
        }

        if (visibleGroupCount == 0)
        {
            hints.Add(new ClientActionHintResponse(
                "Назначить группу",
                "Клиент пока без группы",
                "blue",
                "group",
                null));
        }

        if (hints.Count == 0)
        {
            hints.Add(new ClientActionHintResponse(
                "Планово",
                "Срочных действий нет",
                "gray",
                "check",
                null));
        }

        return hints;
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

    private static string SerializeAuditState(Client client)
    {
        return JsonSerializer.Serialize(
            new ClientAuditState(
                client.Id,
                client.LastName,
                client.FirstName,
                client.MiddleName,
                client.Phone,
                client.BranchId,
                client.Notes,
                client.Status.ToString(),
                client.Contacts
                    .Select(contact => new ClientContactAuditState(contact.Type, contact.FullName, contact.Phone))
                    .OrderBy(contact => contact.FullName, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Type, StringComparer.CurrentCulture)
                    .ThenBy(contact => contact.Phone, StringComparer.CurrentCulture)
                    .ToArray(),
                client.Groups
                    .Select(clientGroup => clientGroup.GroupId)
                    .OrderBy(groupId => groupId)
                    .ToArray(),
                client.CreatedAt,
                client.UpdatedAt),
            AuditSerializerOptions);
    }

    private static (string? Name, DateTimeOffset? ChangedAt) ResolveNotesMetadata(Client client, ILogger? logger)
    {
        if (client.NotesChangedByUserId.HasValue &&
            client.NotesChangedAt.HasValue &&
            client.NotesChangedByUser is not null)
        {
            return (client.NotesChangedByUser.FullName, client.NotesChangedAt);
        }

        if (client.NotesChangedByUserId.HasValue || client.NotesChangedAt.HasValue)
        {
            logger?.LogWarning(
                "Client note metadata is incomplete or its author cannot be resolved. ClientId={ClientId}",
                client.Id);
        }

        return (null, null);
    }

    private static AuditLogEntry BuildNoteAuditEntry(
        Guid actorId,
        Client client,
        string actorLogin,
        string transition)
    {
        return new AuditLogEntry(
            actorId,
            ClientAuditConstants.ClientNoteChangedAction,
            ClientAuditConstants.ClientEntityType,
            client.Id.ToString(),
            ClientAuditResources.ClientNoteChangedDescription(
                actorLogin,
                BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
            NewValueJson: JsonSerializer.Serialize(new { transition }, AuditSerializerOptions));
    }

    private static async Task TryWriteClientAuditAsync(
        IAuditLogService auditLogService,
        GymCrmDbContext dbContext,
        ILoggerFactory loggerFactory,
        Guid actorId,
        Guid clientId,
        AuditLogEntry entry,
        CancellationToken cancellationToken)
    {
        try
        {
            await auditLogService.WriteAsync(entry, cancellationToken);
        }
        catch (Exception exception)
        {
            foreach (var trackedAudit in dbContext.ChangeTracker.Entries<AuditLog>()
                         .Where(tracked => tracked.State == EntityState.Added))
            {
                trackedAudit.State = EntityState.Detached;
            }

            loggerFactory.CreateLogger("ClientAudit").LogError(
                exception,
                "Client audit write failed. ActionType={ActionType} ClientId={ClientId} ActorId={ActorId}",
                entry.ActionType,
                clientId,
                actorId);
        }
    }

    private static string? SerializeMembershipAuditState(ClientMembership? membership)
    {
        if (membership is null)
        {
            return null;
        }

        return JsonSerializer.Serialize(
            new ClientMembershipAuditState(
                membership.Id,
                membership.ClientId,
                membership.SaleId,
                membership.Sale.MembershipCatalogItemId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind.ToString(),
                membership.Sale.PricingMode.ToString(),
                membership.Sale.GrossAmount,
                ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
                membership.Sale.PurchaseDate,
                membership.IndividualValidTo,
                membership.IndividualValidFrom,
                membership.IndividualValidTo,
                membership.ProfessionalComment,
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

    private static string SerializeSaleAuditState(ClientMembershipSaleSnapshotResult sale)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipSaleAuditState(
                sale.Id,
                sale.ClientId,
                sale.MembershipCatalogItemId,
                sale.MembershipName,
                sale.BehaviorKind.ToString(),
                sale.PricingMode.ToString(),
                sale.PurchaseDate,
                sale.GrossAmount,
                sale.CatalogPrice,
                sale.CreatedByUserId,
                sale.CreatedAt),
            AuditSerializerOptions);
    }

    private static string SerializeRefundAuditState(ClientMembershipRefundSnapshotResult refund)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipRefundAuditState(
                refund.Id,
                refund.SaleId,
                refund.ClientId,
                refund.Amount,
                refund.RefundDate,
                refund.Comment,
                refund.CreatedByUserId,
                refund.CreatedAt,
                refund.CanceledAt,
                refund.CanceledByUserId),
            AuditSerializerOptions);
    }

}
