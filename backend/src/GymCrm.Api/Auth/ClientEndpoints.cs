using System.Globalization;
using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
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
        group.MapPost("/", CreateClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}", UpdateClientAsync)
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
        string? membershipType,
        string? membershipExpiresFrom,
        string? membershipExpiresTo,
        bool? hasPhoto,
        bool? hasGroup,
        bool? hasCurrentMembership,
        bool? hasActivePaidMembership,
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
                     membershipType,
                     membershipExpiresFrom,
                     membershipExpiresTo))
        {
            errors[error.Key] = error.Value;
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = ResolvePaging(page, pageSize, skip, take);
        var parsedStatus = ParseStatus(status);
        var parsedPaymentStatus = ParsePaymentStatus(paymentStatus);
        var parsedMembershipState = ParseMembershipState(membershipState);
        var parsedMembershipType = ParseMembershipType(membershipType);
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
                ClientPaymentStatus.Paid => clientsQuery.Where(client => client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(membership => membership.IsPaid)),
                ClientPaymentStatus.Unpaid => clientsQuery.Where(client => client.Memberships
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

        if (parsedMembershipType.HasValue)
        {
            clientsQuery = clientsQuery.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.MembershipType == parsedMembershipType.Value));
        }

        if (hasActivePaidMembership.HasValue)
        {
            clientsQuery = hasActivePaidMembership.Value
                ? clientsQuery.Where(client => client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                            (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed))
                    )
                : clientsQuery.Where(client => !client.Memberships
                    .Where(membership => membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                            (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed)));
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

        var totalCount = await clientsQuery.CountAsync(cancellationToken);
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
                        clientGroup.Group.IsActive,
                        clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                        clientGroup.Group.ScheduleText))
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
                dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Take(1)
                    .Any(
                        membership =>
                            membership.IsPaid &&
                            (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                            (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed)),
                dbContext.ClientMemberships
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
                        membership.MembershipType.ToString(),
                        membership.PurchaseDate,
                        membership.ExpirationDate,
                        membership.IsPaid,
                        membership.SingleVisitUsed))
                    .FirstOrDefault(),
                dbContext.ClientMemberships.Any(membership => membership.ClientId == client.Id && membership.ValidTo == null),
                dbContext.ClientMemberships
                    .Where(membership => membership.ClientId == client.Id && membership.ValidTo == null)
                    .OrderByDescending(membership => membership.ValidFrom)
                    .ThenByDescending(membership => membership.CreatedAt)
                    .ThenByDescending(membership => membership.Id)
                    .Select(membership =>
                        !membership.IsPaid
                            ? ClientMembershipState.Unpaid.ToString()
                            : membership.ExpirationDate != null && membership.ExpirationDate < today
                                ? ClientMembershipState.Expired.ToString()
                                : membership.MembershipType == MembershipType.SingleVisit && membership.SingleVisitUsed
                                    ? ClientMembershipState.UsedSingleVisit.ToString()
                                    : ClientMembershipState.ActivePaid.ToString())
                    .FirstOrDefault() ?? ClientMembershipState.None.ToString(),
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
            archivedCount));
    }

    private static async Task<Results<Ok<IReadOnlyList<ExpiringClientMembershipListItemResponse>>, UnauthorizedHttpResult>> ListExpiringMembershipsAsync(
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

        IReadOnlyList<ExpiringClientMembershipListItemResponse> response = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active)
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
                        membership.MembershipType,
                        membership.ExpirationDate,
                        membership.IsPaid
                    })
                    .FirstOrDefault()
            })
            .Where(candidate =>
                candidate.CurrentMembership != null &&
                candidate.CurrentMembership.ExpirationDate.HasValue &&
                candidate.CurrentMembership.ExpirationDate.Value >= today &&
                candidate.CurrentMembership.ExpirationDate.Value < expiresBefore)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.LastName,
                candidate.FirstName,
                candidate.MiddleName,
                MembershipType = candidate.CurrentMembership!.MembershipType,
                ExpirationDate = candidate.CurrentMembership!.ExpirationDate!.Value,
                candidate.CurrentMembership!.IsPaid
            })
            .OrderBy(candidate => candidate.ExpirationDate)
            .ThenBy(candidate => candidate.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.Id)
            .Select(candidate => new ExpiringClientMembershipListItemResponse(
                candidate.Id,
                BuildClientFullName(
                    candidate.LastName,
                    candidate.FirstName,
                    candidate.MiddleName),
                candidate.MembershipType.ToString(),
                candidate.ExpirationDate,
                candidate.ExpirationDate.DayNumber - today.DayNumber,
                candidate.IsPaid))
            .ToArrayAsync(cancellationToken);

        return TypedResults.Ok(response);
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, ValidationProblem, NotFound, ForbidHttpResult, UnauthorizedHttpResult>> GetClientAsync(
        Guid id,
        int? attendanceSkip,
        int? attendanceTake,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
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

            return TypedResults.Ok(MapDetails(client, attendanceHistory));
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

        return TypedResults.Ok(MapCoachDetails(client, coachGroups, coachAttendanceHistory));
    }

    private static async Task<Results<Created<ClientDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateClientAsync(
        UpsertClientRequest request,
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
            LastName = normalizedRequest.LastName,
            FirstName = normalizedRequest.FirstName,
            MiddleName = normalizedRequest.MiddleName,
            Phone = normalizedRequest.Phone,
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Clients.Add(client);
        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        await ReplaceGroupAssignmentsAsync(client.Id, normalizedRequest.GroupIds, dbContext, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        var createdClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created client '{client.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.ClientCreatedAction,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                ClientAuditResources.ClientCreatedDescription(
                    currentUser.Login,
                    BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)),
                NewValueJson: SerializeAuditState(createdClient)),
            cancellationToken);

        return TypedResults.Created($"/clients/{client.Id}", MapDetails(createdClient, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientAsync(
        Guid id,
        UpsertClientRequest request,
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

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
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
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        await ReplaceGroupAssignmentsAsync(client.Id, normalizedRequest.GroupIds, dbContext, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedClient = await LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{client.Id}' was not found.");

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                ClientAuditConstants.ClientUpdatedAction,
                ClientAuditConstants.ClientEntityType,
                client.Id.ToString(),
                ClientAuditResources.ClientUpdatedDescription(
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

        if (client.Status == targetStatus)
        {
            return TypedResults.Ok(MapDetails(client, EmptyAttendanceHistoryPage()));
        }

        var oldState = SerializeAuditState(client);
        client.Status = targetStatus;
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

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
                SerializeAuditState(client)),
            cancellationToken);

        return TypedResults.Ok(MapDetails(client, EmptyAttendanceHistoryPage()));
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
                        ParseMembershipType(request.MembershipType)!.Value,
                        ParseIsoDate(request.PurchaseDate)!.Value,
                        ParseIsoDate(request.ExpirationDate),
                        request.PaymentAmount!.Value,
                        request.IsPaid!.Value),
                    cancellationToken),
            actionType: ClientAuditConstants.MembershipPurchasedAction,
            descriptionFactory: ClientAuditResources.MembershipPurchasedDescription);
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
                        ParseIsoDate(request.RenewalDate)!.Value,
                        ParseIsoDate(request.ExpirationDate),
                        request.PaymentAmount!.Value,
                        request.IsPaid!.Value),
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
                        ParseMembershipType(request.MembershipType)!.Value,
                        ParseIsoDate(request.PurchaseDate)!.Value,
                        ParseIsoDate(request.ExpirationDate),
                        request.PaymentAmount!.Value,
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

        return TypedResults.Ok(MapDetails(clientAfter, EmptyAttendanceHistoryPage()));
    }

    private static async Task<Client?> LoadClientSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .Include(client => client.Contacts)
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.PaidByUser)
            .Include(client => client.Groups)
                .ThenInclude(clientGroup => clientGroup.Group)
                    .ThenInclude(group => group.Trainers)
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
                attendance.Group.ScheduleText))
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
        string? membershipType,
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

        if (!string.IsNullOrWhiteSpace(membershipType) && ParseMembershipType(membershipType) is null)
        {
            errors["membershipType"] = [ClientResources.InvalidMembershipType];
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

    private static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedClientRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
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

        ValidateNamePart(request.LastName, "lastName", ClientResources.LastNameTooLong, errors);
        ValidateNamePart(request.FirstName, "firstName", ClientResources.FirstNameTooLong, errors);
        ValidateNamePart(request.MiddleName, "middleName", ClientResources.MiddleNameTooLong, errors);

        if (string.IsNullOrWhiteSpace(request.LastName) &&
            string.IsNullOrWhiteSpace(request.FirstName) &&
            string.IsNullOrWhiteSpace(request.MiddleName))
        {
            errors["fullName"] = [ClientResources.FullNameRequired];
        }

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
            return errors;
        }

        var existingGroupCount = await dbContext.TrainingGroups
            .AsNoTracking()
            .Where(group => request.GroupIds.Contains(group.Id))
            .CountAsync(cancellationToken);

        if (existingGroupCount != request.GroupIds.Count)
        {
            errors["groupIds"] = [ClientResources.GroupsMustExist];
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
        IReadOnlyList<Guid> requestedGroupIds,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requested = requestedGroupIds.ToHashSet();

        var existingGroups = await dbContext.ClientGroups
            .Where(clientGroup => clientGroup.ClientId == clientId)
            .ToArrayAsync(cancellationToken);

        var groupsToRemove = existingGroups
            .Where(clientGroup => !requested.Contains(clientGroup.GroupId))
            .ToArray();

        if (groupsToRemove.Length > 0)
        {
            dbContext.ClientGroups.RemoveRange(groupsToRemove);
        }

        var existingGroupIds = existingGroups
            .Select(clientGroup => clientGroup.GroupId)
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
                GroupId = groupId
            });
        }
    }

    private static Dictionary<string, string[]> ValidatePurchaseMembershipRequest(PurchaseClientMembershipRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var membershipType = ValidateRequiredMembershipType(request.MembershipType, errors);
        var purchaseDate = ValidateRequiredDate(request.PurchaseDate, "purchaseDate", ClientResources.PurchaseDateRequired, errors);
        var expirationDate = ValidateOptionalDate(request.ExpirationDate, "expirationDate", errors);

        ValidatePaymentAmount(request.PaymentAmount, errors);
        ValidateIsPaidRequired(request.IsPaid, errors);
        ValidateMembershipDateRange(membershipType, purchaseDate, expirationDate, errors, "expirationDate");

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRenewMembershipRequest(
        RenewClientMembershipRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        var currentMembership = GetCurrentMembership(client);

        if (currentMembership is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForRenewal];
            return errors;
        }

        var renewalDate = ValidateRequiredDate(request.RenewalDate, "renewalDate", ClientResources.RenewalDateRequired, errors);
        var expirationDate = ValidateOptionalDate(request.ExpirationDate, "expirationDate", errors);
        ValidateOptionalMatchingMembershipType(request.MembershipType, currentMembership.MembershipType, errors);
        ValidatePaymentAmount(request.PaymentAmount, errors);
        ValidateIsPaidRequired(request.IsPaid, errors);

        if (currentMembership.MembershipType is not MembershipType.SingleVisit &&
            currentMembership.ExpirationDate is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipWithoutExpirationDate];
        }

        if (renewalDate.HasValue &&
            expirationDate.HasValue &&
            expirationDate.Value < renewalDate.Value)
        {
            errors["expirationDate"] = [ClientResources.ExpirationBeforeRenewalDate];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateCorrectMembershipRequest(
        CorrectClientMembershipRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        var currentMembership = GetCurrentMembership(client);
        if (currentMembership is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForCorrection];
            return errors;
        }

        var membershipType = ValidateRequiredMembershipType(request.MembershipType, errors);
        var purchaseDate = ValidateRequiredDate(request.PurchaseDate, "purchaseDate", ClientResources.PurchaseDateRequired, errors);
        var expirationDate = ValidateOptionalDate(request.ExpirationDate, "expirationDate", errors);

        ValidatePaymentAmount(request.PaymentAmount, errors);
        ValidateIsPaidRequired(request.IsPaid, errors);
        ValidateMembershipDateRange(membershipType, purchaseDate, expirationDate, errors, "expirationDate");

        return errors;
    }

    private static Dictionary<string, string[]> ValidateMarkMembershipPaymentRequest(
        MarkMembershipPaymentRequest request,
        Client client)
    {
        var errors = new Dictionary<string, string[]>();
        var currentMembership = GetCurrentMembership(client);
        if (currentMembership is null)
        {
            errors["currentMembership"] = [ClientResources.CurrentMembershipMissingForPaymentMark];
            return errors;
        }

        ValidateOptionalMatchingMembershipType(request.MembershipType, currentMembership.MembershipType, errors);
        ValidateOptionalPaymentAmount(request.PaymentAmount, errors);

        if (request.PaymentAmount.HasValue && request.PaymentAmount.Value != currentMembership.PaymentAmount)
        {
            errors["paymentAmount"] = [ClientResources.PaymentAmountImmutableForPaymentMark];
        }

        if (!request.IsPaid.HasValue)
        {
            errors["isPaid"] = [ClientResources.IsPaidRequired];
        }
        else if (!request.IsPaid.Value)
        {
            errors["isPaid"] = [ClientResources.PaymentMarkMustSetPaid];
        }
        else if (currentMembership.IsPaid)
        {
            errors["isPaid"] = [ClientResources.CurrentMembershipAlreadyPaid];
        }

        return errors;
    }

    private static void ValidateMembershipDateRange(
        MembershipType? membershipType,
        DateOnly? purchaseDate,
        DateOnly? expirationDate,
        Dictionary<string, string[]> errors,
        string expirationDateKey)
    {
        if (membershipType is MembershipType.SingleVisit || !purchaseDate.HasValue || !expirationDate.HasValue)
        {
            return;
        }

        if (expirationDate.Value < purchaseDate.Value)
        {
            errors[expirationDateKey] = [ClientResources.ExpirationBeforePurchaseDate];
        }
    }

    private static MembershipType? ValidateRequiredMembershipType(
        string? membershipType,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(membershipType))
        {
            errors["membershipType"] = [ClientResources.MembershipTypeRequired];
            return null;
        }

        var parsedMembershipType = ParseMembershipType(membershipType);
        if (parsedMembershipType is null)
        {
            errors["membershipType"] = [ClientResources.InvalidMembershipType];
        }

        return parsedMembershipType;
    }

    private static void ValidateOptionalMatchingMembershipType(
        string? membershipType,
        MembershipType expectedMembershipType,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(membershipType))
        {
            return;
        }

        var parsedMembershipType = ParseMembershipType(membershipType);
        if (parsedMembershipType is null)
        {
            errors["membershipType"] = [ClientResources.InvalidMembershipType];
            return;
        }

        if (parsedMembershipType.Value != expectedMembershipType)
        {
            errors["membershipType"] = [ClientResources.CurrentMembershipTypeMismatch(expectedMembershipType.ToString())];
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

    private static void ValidatePaymentAmount(
        decimal? value,
        Dictionary<string, string[]> errors)
    {
        if (!value.HasValue)
        {
            errors["paymentAmount"] = [ClientResources.PaymentAmountRequired];
            return;
        }

        ValidateOptionalPaymentAmount(value, errors);
    }

    private static void ValidateOptionalPaymentAmount(
        decimal? value,
        Dictionary<string, string[]> errors)
    {
        if (value.HasValue && value.Value < 0)
        {
            errors["paymentAmount"] = [ClientResources.PaymentAmountMustBeNonNegative];
        }
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

    private static MembershipType? ParseMembershipType(string? membershipType)
    {
        return Enum.TryParse<MembershipType>(membershipType?.Trim(), ignoreCase: true, out var parsedMembershipType)
            ? parsedMembershipType
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
            _ => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.MembershipChangeFailed]
            }
        };
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
                membership.ExpirationDate.HasValue &&
                (!membershipExpirationFrom.HasValue || membership.ExpirationDate.Value >= membershipExpirationFrom.Value) &&
                (!membershipExpirationTo.HasValue || membership.ExpirationDate.Value <= membershipExpirationTo.Value)));
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
            ClientMembershipState.None => query.Where(client => !client.Memberships.Any(membership => membership.ValidTo == null)),
            ClientMembershipState.Unpaid => query.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => !membership.IsPaid)),
            ClientMembershipState.Expired => query.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.IsPaid && membership.ExpirationDate != null && membership.ExpirationDate < today)),
            ClientMembershipState.UsedSingleVisit => query.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(membership => membership.IsPaid && membership.MembershipType == MembershipType.SingleVisit && membership.SingleVisitUsed)),
            ClientMembershipState.ActivePaid => query.Where(client => client.Memberships
                .Where(membership => membership.ValidTo == null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .Take(1)
                .Any(
                    membership =>
                        membership.IsPaid &&
                        (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                        (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed))),
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
                    HasActivePaidMembership = HasActivePaidMembership(currentMembership),
                    HasUnpaidCurrentMembership = currentMembership is not null && !currentMembership.IsPaid,
                    CurrentMembershipSummary = MapCurrentMembershipSummary(currentMembership),
                    HasCurrentMembership = currentMembership is not null,
                    MembershipState = GetMembershipState(currentMembership).ToString(),
                    LastVisitDate = lastVisitDate
                };
            })
            .ToArray();
    }

    private static ClientListItemResponse MapManagerListItem(Client client)
    {
        var groups = MapGroups(client.Groups);
        var currentMembership = GetCurrentMembership(client);

        return new ClientListItemResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            client.Contacts.Count,
            MapPhoto(client),
            HasActivePaidMembership(currentMembership),
            currentMembership is not null && !currentMembership.IsPaid,
            MapCurrentMembershipSummary(currentMembership),
            currentMembership is not null,
            GetMembershipState(currentMembership).ToString(),
            client.AttendanceEntries
                .Where(attendance => attendance.IsPresent)
                .OrderByDescending(attendance => attendance.TrainingDate)
                .ThenByDescending(attendance => attendance.UpdatedAt)
                .Select(attendance => (DateOnly?)attendance.TrainingDate)
                .FirstOrDefault(),
            client.UpdatedAt);
    }

    private static ClientListItemResponse MapCoachListItem(Client client, Guid coachId)
    {
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
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            0,
            MapPhoto(client),
            HasActivePaidMembership(currentMembership),
            currentMembership is not null && !currentMembership.IsPaid,
            MapCurrentMembershipSummary(currentMembership),
            currentMembership is not null,
            GetMembershipState(currentMembership).ToString(),
            client.AttendanceEntries
                .Where(attendance =>
                    attendance.IsPresent &&
                    coachGroups.Select(group => group.GroupId).Contains(attendance.GroupId))
                .OrderByDescending(attendance => attendance.TrainingDate)
                .ThenByDescending(attendance => attendance.UpdatedAt)
                .Select(attendance => (DateOnly?)attendance.TrainingDate)
                .FirstOrDefault(),
            client.UpdatedAt);
    }

    private static ClientDetailsResponse MapDetails(
        Client client,
        ClientAttendanceHistoryPageResponse attendanceHistory)
    {
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
        var membershipHistory = MapMembershipHistory(client.Memberships);
        var currentMembership = GetCurrentMembership(client);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            client.Phone,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            contacts,
            MapPhoto(client),
            HasActivePaidMembership(currentMembership),
            currentMembership is not null && !currentMembership.IsPaid,
            currentMembership is null ? null : MapMembership(currentMembership),
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
        ClientAttendanceHistoryPageResponse attendanceHistory)
    {
        var groups = MapGroups(coachGroups);
        var currentMembership = GetCurrentMembership(client);

        return new ClientDetailsResponse(
            client.Id,
            client.LastName,
            client.FirstName,
            client.MiddleName,
            BuildClientFullName(client.LastName, client.FirstName, client.MiddleName),
            string.Empty,
            client.Status.ToString(),
            groups.Select(group => group.Id).ToArray(),
            groups,
            [],
            MapPhoto(client),
            HasActivePaidMembership(currentMembership),
            currentMembership is not null && !currentMembership.IsPaid,
            null,
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
                clientGroup.Group.IsActive,
                clientGroup.Group.TrainingStartTime.ToString("HH\\:mm"),
                clientGroup.Group.ScheduleText))
            .OrderBy(group => group.Name, StringComparer.CurrentCulture)
            .ThenBy(group => group.Id)
            .ToArray();
    }

    private static IReadOnlyList<ClientMembershipResponse> MapMembershipHistory(ICollection<ClientMembership> memberships)
    {
        return memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .Select(MapMembership)
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

    private static ClientMembershipResponse MapMembership(ClientMembership membership)
    {
        return new ClientMembershipResponse(
            membership.Id,
            membership.MembershipType.ToString(),
            membership.PurchaseDate,
            membership.ExpirationDate,
            membership.PaymentAmount,
            membership.IsPaid,
            membership.SingleVisitUsed,
            membership.PaidByUserId,
            membership.PaidByUser?.FullName,
            membership.PaidAt,
            membership.ChangeReason.ToString(),
            membership.ValidFrom,
            membership.ValidTo,
            membership.CreatedAt);
    }

    private static CurrentMembershipSummaryResponse? MapCurrentMembershipSummary(ClientMembership? membership)
    {
        return membership is null
            ? null
            : new CurrentMembershipSummaryResponse(
                membership.Id,
                membership.MembershipType.ToString(),
                membership.PurchaseDate,
                membership.ExpirationDate,
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

    private static bool HasActivePaidMembership(ClientMembership? membership)
    {
        if (membership is null || !membership.IsPaid)
        {
            return false;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < today)
        {
            return false;
        }

        return membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed;
    }

    private static ClientMembershipState GetMembershipState(ClientMembership? membership)
    {
        if (membership is null)
        {
            return ClientMembershipState.None;
        }

        if (!membership.IsPaid)
        {
            return ClientMembershipState.Unpaid;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < today)
        {
            return ClientMembershipState.Expired;
        }

        if (membership.MembershipType == MembershipType.SingleVisit && membership.SingleVisitUsed)
        {
            return ClientMembershipState.UsedSingleVisit;
        }

        return ClientMembershipState.ActivePaid;
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
