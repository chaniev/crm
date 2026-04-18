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
    private const int DefaultPage = 1;
    private const int DefaultTake = 20;
    private const int MaxTake = 100;
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

    private static async Task<Results<Ok<IReadOnlyList<ClientListItemResponse>>, ValidationProblem, ForbidHttpResult, UnauthorizedHttpResult>> ListClientsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? status,
        bool? isArchived,
        string? fullName,
        string? phone,
        Guid? groupId,
        string? paymentStatus,
        string? membershipExpiresFrom,
        string? membershipExpiresTo,
        bool? hasPhoto,
        bool? hasGroup,
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
        foreach (var error in ValidateListFilters(status, paymentStatus, membershipExpiresFrom, membershipExpiresTo))
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
        var membershipExpirationFrom = ParseIsoDate(membershipExpiresFrom);
        var membershipExpirationTo = ParseIsoDate(membershipExpiresTo);
        var hasElevatedClientAccess = currentUser.Role is UserRole.HeadCoach or UserRole.Administrator;

        if (!hasElevatedClientAccess && !string.IsNullOrWhiteSpace(phone))
        {
            return TypedResults.Forbid();
        }

        var query = dbContext.Clients.AsNoTracking();
        if (currentUser.Role == UserRole.Coach)
        {
            query = ApplyCoachClientScope(query, currentUser.Id, dbContext);
        }

        if (parsedStatus.HasValue)
        {
            query = query.Where(client => client.Status == parsedStatus.Value);
        }

        if (isArchived.HasValue)
        {
            var archivedStatus = isArchived.Value
                ? ClientStatus.Archived
                : ClientStatus.Active;
            query = query.Where(client => client.Status == archivedStatus);
        }

        if (!string.IsNullOrWhiteSpace(fullName))
        {
            query = ApplyFullNameSearch(query, fullName);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            query = ApplyPhoneSearch(query, phone);
        }

        if (groupId.HasValue)
        {
            query = query.Where(client => client.Groups.Any(clientGroup => clientGroup.GroupId == groupId.Value));
        }

        if (parsedPaymentStatus.HasValue)
        {
            query = parsedPaymentStatus.Value switch
            {
                ClientPaymentStatus.Paid => query.Where(client => client.Memberships.Any(
                    membership => membership.ValidTo == null && membership.IsPaid)),
                ClientPaymentStatus.Unpaid => query.Where(client => client.Memberships.Any(
                    membership => membership.ValidTo == null && !membership.IsPaid)),
                _ => query
            };
        }

        if (hasPhoto.HasValue)
        {
            query = hasPhoto.Value
                ? query.Where(client =>
                    client.PhotoPath != null &&
                    client.PhotoPath != string.Empty &&
                    client.PhotoContentType != null &&
                    client.PhotoContentType != string.Empty &&
                    client.PhotoSizeBytes != null &&
                    client.PhotoUploadedAt != null)
                : query.Where(client =>
                    client.PhotoPath == null ||
                    client.PhotoPath == string.Empty ||
                    client.PhotoContentType == null ||
                    client.PhotoContentType == string.Empty ||
                    client.PhotoSizeBytes == null ||
                    client.PhotoUploadedAt == null);
        }

        if (hasGroup.HasValue)
        {
            query = hasGroup.Value
                ? query.Where(client => client.Groups.Any())
                : query.Where(client => !client.Groups.Any());
        }

        if (hasActivePaidMembership.HasValue)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            query = hasActivePaidMembership.Value
                ? query.Where(client => client.Memberships.Any(
                    membership =>
                        membership.ValidTo == null &&
                        membership.IsPaid &&
                        (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                        (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed)))
                : query.Where(client => !client.Memberships.Any(
                    membership =>
                        membership.ValidTo == null &&
                        membership.IsPaid &&
                        (membership.ExpirationDate == null || membership.ExpirationDate >= today) &&
                        (membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed)));
        }

        var orderedQuery = query
            .OrderBy(client => client.LastName ?? string.Empty)
            .ThenBy(client => client.FirstName ?? string.Empty)
            .ThenBy(client => client.MiddleName ?? string.Empty)
            .ThenBy(client => client.Id);

        IReadOnlyList<ClientListItemResponse> response;
        if (currentUser.Role == UserRole.Coach)
        {
            var clientsQuery = orderedQuery
                .Include(client => client.Memberships)
                .Include(client => client.Groups)
                    .ThenInclude(clientGroup => clientGroup.Group)
                        .ThenInclude(group => group.Trainers)
                .AsSplitQuery();

            var clients = membershipExpirationFrom.HasValue || membershipExpirationTo.HasValue
                ? (await clientsQuery.ToListAsync(cancellationToken))
                    .Where(client => MatchesMembershipExpirationRange(client, membershipExpirationFrom, membershipExpirationTo))
                    .Skip(paging.Skip)
                    .Take(paging.Take)
                    .ToArray()
                : await clientsQuery
                    .Skip(paging.Skip)
                    .Take(paging.Take)
                    .ToArrayAsync(cancellationToken);

            response = clients
                .Select(client => MapListItem(client, currentUser))
                .ToArray();
        }
        else
        {
            var clientsQuery = orderedQuery
                .Include(client => client.Contacts)
                .Include(client => client.Memberships)
                .Include(client => client.Groups)
                    .ThenInclude(clientGroup => clientGroup.Group)
                .AsSplitQuery();

            var clients = membershipExpirationFrom.HasValue || membershipExpirationTo.HasValue
                ? (await clientsQuery.ToListAsync(cancellationToken))
                    .Where(client => MatchesMembershipExpirationRange(client, membershipExpirationFrom, membershipExpirationTo))
                    .Skip(paging.Skip)
                    .Take(paging.Take)
                    .ToArray()
                : await clientsQuery
                    .Skip(paging.Skip)
                    .Take(paging.Take)
                    .ToArrayAsync(cancellationToken);

            response = clients
                .Select(client => MapListItem(client, currentUser))
                .ToArray();
        }

        return TypedResults.Ok(response);
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
        var expiresBefore = today.AddDays(10);

        var clients = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Status == ClientStatus.Active)
            .Include(client => client.Memberships)
            .ToArrayAsync(cancellationToken);

        IReadOnlyList<ExpiringClientMembershipListItemResponse> response = clients
            .Select(client => new
            {
                Client = client,
                CurrentMembership = GetCurrentMembership(client)
            })
            .Where(candidate =>
                candidate.CurrentMembership?.ExpirationDate is DateOnly expirationDate &&
                expirationDate >= today &&
                expirationDate < expiresBefore)
            .OrderBy(candidate => candidate.CurrentMembership!.ExpirationDate)
            .ThenBy(candidate => candidate.Client.LastName ?? string.Empty)
            .ThenBy(candidate => candidate.Client.FirstName ?? string.Empty)
            .ThenBy(candidate => candidate.Client.MiddleName ?? string.Empty)
            .ThenBy(candidate => candidate.Client.Id)
            .Select(candidate => new ExpiringClientMembershipListItemResponse(
                candidate.Client.Id,
                BuildClientFullName(
                    candidate.Client.LastName,
                    candidate.Client.FirstName,
                    candidate.Client.MiddleName),
                candidate.CurrentMembership!.MembershipType.ToString(),
                candidate.CurrentMembership.ExpirationDate!.Value,
                candidate.CurrentMembership.ExpirationDate.Value.DayNumber - today.DayNumber,
                candidate.CurrentMembership.IsPaid))
            .ToArray();

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
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
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
                "ClientCreated",
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' created client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
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
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
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
                "ClientUpdated",
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' updated client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
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
            "ClientArchived",
            "archived",
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
            "ClientRestored",
            "restored",
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
        string actionVerb,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
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
                "Client",
                client.Id.ToString(),
                $"User '{currentUser.Login}' {actionVerb} client '{BuildClientFullName(client.LastName, client.FirstName, client.MiddleName)}'.",
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
            actionType: "ClientMembershipPurchased",
            actionVerb: "purchased");
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
            actionType: "ClientMembershipRenewed",
            actionVerb: "renewed");
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
            actionType: "ClientMembershipCorrected",
            actionVerb: "corrected");
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
            actionType: "ClientMembershipPaymentMarked",
            actionVerb: "marked payment for");
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
        string actionVerb)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
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
                "ClientMembership",
                currentMembershipAfter?.Id.ToString() ?? clientAfter.Id.ToString(),
                $"User '{currentUser.Login}' {actionVerb} client membership for '{BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)}'.",
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
                errors["page"] = ["Номер страницы должен быть больше 0."];
            }

            if (pageSize is <= 0 or > MaxTake)
            {
                errors["pageSize"] = [$"Размер страницы должен быть в диапазоне от 1 до {MaxTake}."];
            }

            return errors;
        }

        if (skip is < 0)
        {
            errors["skip"] = ["Параметр skip не может быть отрицательным."];
        }

        if (take is <= 0 or > MaxTake)
        {
            errors["take"] = [$"Параметр take должен быть в диапазоне от 1 до {MaxTake}."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateAttendanceHistoryPaging(int? attendanceSkip, int? attendanceTake)
    {
        var errors = new Dictionary<string, string[]>();

        if (attendanceSkip is < 0)
        {
            errors["attendanceSkip"] = ["Параметр attendanceSkip не может быть отрицательным."];
        }

        if (attendanceTake is <= 0 or > MaxTake)
        {
            if (attendanceTake.HasValue)
            {
                errors["attendanceTake"] = [$"Параметр attendanceTake должен быть в диапазоне от 1 до {MaxTake}."];
            }
        }

        return errors;
    }

    private static Paging ResolvePaging(int? page, int? pageSize, int? skip, int? take)
    {
        if (page.HasValue || pageSize.HasValue)
        {
            var resolvedPage = page ?? DefaultPage;
            var resolvedPageSize = pageSize ?? DefaultTake;
            return new Paging((resolvedPage - 1) * resolvedPageSize, resolvedPageSize);
        }

        return new Paging(skip ?? 0, take ?? DefaultTake);
    }

    private static AttendanceHistoryPaging ResolveAttendanceHistoryPaging(int? attendanceSkip, int? attendanceTake)
    {
        return new AttendanceHistoryPaging(attendanceSkip ?? 0, attendanceTake ?? DefaultTake);
    }

    private static ClientAttendanceHistoryPageResponse EmptyAttendanceHistoryPage()
    {
        return new ClientAttendanceHistoryPageResponse([], 0, DefaultTake, 0, false);
    }

    private static Dictionary<string, string[]> ValidateListFilters(
        string? status,
        string? paymentStatus,
        string? membershipExpiresFrom,
        string? membershipExpiresTo)
    {
        var errors = new Dictionary<string, string[]>();

        if (!string.IsNullOrWhiteSpace(status) && ParseStatus(status) is null)
        {
            errors["status"] = ["Укажите корректный статус клиента."];
        }

        if (!string.IsNullOrWhiteSpace(paymentStatus) && ParsePaymentStatus(paymentStatus) is null)
        {
            errors["paymentStatus"] = ["Укажите корректный фильтр оплаты клиента."];
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
            errors["membershipExpiresTo"] = ["Дата окончания диапазона не может быть раньше начальной даты."];
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
            errors["phone"] = ["Укажите номер телефона."];
        }
        else if (request.Phone.Length > 32)
        {
            errors["phone"] = ["Номер телефона не должен превышать 32 символа."];
        }

        ValidateNamePart(request.LastName, "lastName", "Фамилия не должна превышать 128 символов.", errors);
        ValidateNamePart(request.FirstName, "firstName", "Имя не должно превышать 128 символов.", errors);
        ValidateNamePart(request.MiddleName, "middleName", "Отчество не должно превышать 128 символов.", errors);

        if (string.IsNullOrWhiteSpace(request.LastName) &&
            string.IsNullOrWhiteSpace(request.FirstName) &&
            string.IsNullOrWhiteSpace(request.MiddleName))
        {
            errors["fullName"] = ["Укажите хотя бы одно из полей фамилии, имени или отчества."];
        }

        if (request.RawContacts?.Count > 2)
        {
            errors["contacts"] = ["У клиента может быть не более 2 контактных лиц."];
        }

        for (var index = 0; index < request.Contacts.Count; index++)
        {
            var contact = request.Contacts[index];
            if (string.IsNullOrWhiteSpace(contact.Type))
            {
                errors[$"contacts[{index}].type"] = ["Укажите тип контактного лица."];
            }
            else if (contact.Type.Length > 64)
            {
                errors[$"contacts[{index}].type"] = ["Тип контактного лица не должен превышать 64 символа."];
            }

            if (string.IsNullOrWhiteSpace(contact.FullName))
            {
                errors[$"contacts[{index}].fullName"] = ["Укажите ФИО контактного лица."];
            }
            else if (contact.FullName.Length > 256)
            {
                errors[$"contacts[{index}].fullName"] = ["ФИО контактного лица не должно превышать 256 символов."];
            }

            if (string.IsNullOrWhiteSpace(contact.Phone))
            {
                errors[$"contacts[{index}].phone"] = ["Укажите телефон контактного лица."];
            }
            else if (contact.Phone.Length > 32)
            {
                errors[$"contacts[{index}].phone"] = ["Телефон контактного лица не должен превышать 32 символа."];
            }
        }

        if (request.RawGroupIds?.Any(groupId => groupId == Guid.Empty) == true)
        {
            errors["groupIds"] = ["Список групп содержит некорректный идентификатор."];
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
            errors["groupIds"] = ["Можно привязать клиента только к существующим группам."];
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
        var purchaseDate = ValidateRequiredDate(request.PurchaseDate, "purchaseDate", "Укажите дату покупки абонемента.", errors);
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
            errors["currentMembership"] = ["У клиента нет текущего абонемента для продления."];
            return errors;
        }

        var renewalDate = ValidateRequiredDate(request.RenewalDate, "renewalDate", "Укажите дату продления абонемента.", errors);
        var expirationDate = ValidateOptionalDate(request.ExpirationDate, "expirationDate", errors);
        ValidateOptionalMatchingMembershipType(request.MembershipType, currentMembership.MembershipType, errors);
        ValidatePaymentAmount(request.PaymentAmount, errors);
        ValidateIsPaidRequired(request.IsPaid, errors);

        if (currentMembership.MembershipType is not MembershipType.SingleVisit &&
            currentMembership.ExpirationDate is null)
        {
            errors["currentMembership"] = ["У текущего абонемента не указана дата окончания, продление недоступно."];
        }

        if (renewalDate.HasValue &&
            expirationDate.HasValue &&
            expirationDate.Value < renewalDate.Value)
        {
            errors["expirationDate"] = ["Дата окончания не может быть раньше даты продления."];
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
            errors["currentMembership"] = ["У клиента нет текущего абонемента для исправления."];
            return errors;
        }

        var membershipType = ValidateRequiredMembershipType(request.MembershipType, errors);
        var purchaseDate = ValidateRequiredDate(request.PurchaseDate, "purchaseDate", "Укажите дату покупки абонемента.", errors);
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
            errors["currentMembership"] = ["У клиента нет текущего абонемента для отметки оплаты."];
            return errors;
        }

        ValidateOptionalMatchingMembershipType(request.MembershipType, currentMembership.MembershipType, errors);
        ValidateOptionalPaymentAmount(request.PaymentAmount, errors);

        if (request.PaymentAmount.HasValue && request.PaymentAmount.Value != currentMembership.PaymentAmount)
        {
            errors["paymentAmount"] = ["Сумму оплаты можно изменить только через исправление абонемента."];
        }

        if (!request.IsPaid.HasValue)
        {
            errors["isPaid"] = ["Укажите признак оплаты абонемента."];
        }
        else if (!request.IsPaid.Value)
        {
            errors["isPaid"] = ["Отметка оплаты должна устанавливать значение \"оплачен\"."];
        }
        else if (currentMembership.IsPaid)
        {
            errors["isPaid"] = ["Оплата по текущему абонементу уже отмечена."];
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
            errors[expirationDateKey] = ["Дата окончания не может быть раньше даты покупки."];
        }
    }

    private static MembershipType? ValidateRequiredMembershipType(
        string? membershipType,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(membershipType))
        {
            errors["membershipType"] = ["Укажите тип абонемента."];
            return null;
        }

        var parsedMembershipType = ParseMembershipType(membershipType);
        if (parsedMembershipType is null)
        {
            errors["membershipType"] = ["Укажите корректный тип абонемента."];
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
            errors["membershipType"] = ["Укажите корректный тип абонемента."];
            return;
        }

        if (parsedMembershipType.Value != expectedMembershipType)
        {
            errors["membershipType"] = [$"Текущий абонемент клиента имеет тип '{expectedMembershipType}'."];
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
            errors[key] = ["Укажите корректную дату в формате yyyy-MM-dd."];
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
            errors[key] = ["Укажите корректную дату в формате yyyy-MM-dd."];
        }

        return parsedDate;
    }

    private static void ValidatePaymentAmount(
        decimal? value,
        Dictionary<string, string[]> errors)
    {
        if (!value.HasValue)
        {
            errors["paymentAmount"] = ["Укажите сумму оплаты."];
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
            errors["paymentAmount"] = ["Сумма оплаты не может быть отрицательной."];
        }
    }

    private static void ValidateIsPaidRequired(
        bool? isPaid,
        Dictionary<string, string[]> errors)
    {
        if (!isPaid.HasValue)
        {
            errors["isPaid"] = ["Укажите признак оплаты абонемента."];
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
                ["membership"] = ["Запрос на изменение абонемента содержит некорректные данные."]
            },
            ClientMembershipMutationError.CurrentMembershipMissing => new Dictionary<string, string[]>
            {
                ["currentMembership"] = ["У клиента нет текущего абонемента для этого действия."]
            },
            ClientMembershipMutationError.CurrentMembershipAlreadyPaid => new Dictionary<string, string[]>
            {
                ["currentMembership"] = ["Оплата по текущему абонементу уже отмечена."]
            },
            _ => new Dictionary<string, string[]>
            {
                ["membership"] = ["Не удалось изменить данные абонемента."]
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
            errors[key] = ["Укажите корректную дату в формате yyyy-MM-dd."];
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

    private static async Task<ProblemHttpResult?> ValidateAntiforgeryAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(httpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return TypedResults.Problem(
                title: AuthConstants.InvalidCsrfProblemTitle,
                detail: AuthConstants.InvalidCsrfProblemDetail,
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static ClientListItemResponse MapListItem(Client client, User currentUser)
    {
        return currentUser.Role == UserRole.Coach
            ? MapCoachListItem(client, currentUser.Id)
            : MapManagerListItem(client);
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
            HasActivePaidMembership(GetCurrentMembership(client)),
            GetCurrentMembership(client) is not null && !GetCurrentMembership(client)!.IsPaid,
            membershipHistory.FirstOrDefault(membership => membership.ValidTo is null),
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
            HasActivePaidMembership(GetCurrentMembership(client)),
            GetCurrentMembership(client) is not null && !GetCurrentMembership(client)!.IsPaid,
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

    private static ClientMembership? GetCurrentMembership(Client client)
    {
        return client.Memberships
            .OrderByDescending(membership => membership.ValidFrom)
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

    private static bool MatchesMembershipExpirationRange(
        Client client,
        DateOnly? membershipExpirationFrom,
        DateOnly? membershipExpirationTo)
    {
        var expirationDate = GetCurrentMembership(client)?.ExpirationDate;

        return expirationDate.HasValue &&
            (!membershipExpirationFrom.HasValue || expirationDate.Value >= membershipExpirationFrom.Value) &&
            (!membershipExpirationTo.HasValue || expirationDate.Value <= membershipExpirationTo.Value);
    }

    private static string BuildClientFullName(string? lastName, string? firstName, string? middleName)
    {
        var fullName = string.Join(
            ' ',
            new[] { lastName, firstName, middleName }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));

        return string.IsNullOrWhiteSpace(fullName)
            ? "Клиент без имени"
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

    private sealed record Paging(int Skip, int Take);

    private sealed record AttendanceHistoryPaging(int Skip, int Take);

    private sealed record UpsertClientRequest(
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string? Phone,
        IReadOnlyList<UpsertClientContactRequest>? Contacts,
        IReadOnlyList<Guid>? GroupIds);

    private sealed record UpsertClientContactRequest(
        string? Type,
        string? FullName,
        string? Phone);

    private sealed record NormalizedClientRequest(
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string Phone,
        IReadOnlyList<UpsertClientContactRequest>? RawContacts,
        IReadOnlyList<NormalizedClientContactRequest> Contacts,
        IReadOnlyList<Guid>? RawGroupIds,
        IReadOnlyList<Guid> GroupIds);

    private sealed record NormalizedClientContactRequest(
        string Type,
        string FullName,
        string Phone);

    private sealed record ClientListItemResponse(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string FullName,
        string Phone,
        string Status,
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<ClientGroupSummaryResponse> Groups,
        int ContactCount,
        ClientPhotoSummaryResponse? Photo,
        bool HasActivePaidMembership,
        bool HasUnpaidCurrentMembership,
        DateTimeOffset UpdatedAt);

    private sealed record ExpiringClientMembershipListItemResponse(
        Guid ClientId,
        string FullName,
        string MembershipType,
        DateOnly ExpirationDate,
        int DaysUntilExpiration,
        bool IsPaid);

    private sealed record ClientDetailsResponse(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string FullName,
        string Phone,
        string Status,
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<ClientGroupSummaryResponse> Groups,
        IReadOnlyList<ClientContactResponse> Contacts,
        ClientPhotoSummaryResponse? Photo,
        bool HasActivePaidMembership,
        bool HasUnpaidCurrentMembership,
        ClientMembershipResponse? CurrentMembership,
        IReadOnlyList<ClientMembershipResponse> MembershipHistory,
        IReadOnlyList<ClientAttendanceHistoryEntryResponse> AttendanceHistory,
        int AttendanceHistorySkip,
        int AttendanceHistoryTake,
        int AttendanceHistoryTotalCount,
        bool AttendanceHistoryHasMore,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record ClientAttendanceHistoryPageResponse(
        IReadOnlyList<ClientAttendanceHistoryEntryResponse> Items,
        int Skip,
        int Take,
        int TotalCount,
        bool HasMore);

    private sealed record ClientGroupSummaryResponse(
        Guid Id,
        string Name,
        bool IsActive,
        string? TrainingStartTime,
        string? ScheduleText);

    private sealed record ClientContactResponse(
        string Type,
        string FullName,
        string Phone);

    private sealed record ClientPhotoSummaryResponse(
        string Path,
        string ContentType,
        long SizeBytes,
        DateTimeOffset UploadedAt,
        bool HasPhoto);

    private sealed record ClientMembershipResponse(
        Guid Id,
        string MembershipType,
        DateOnly PurchaseDate,
        DateOnly? ExpirationDate,
        decimal PaymentAmount,
        bool IsPaid,
        bool SingleVisitUsed,
        Guid? PaidByUserId,
        string? PaidByUserFullName,
        DateTimeOffset? PaidAt,
        string ChangeReason,
        DateTimeOffset ValidFrom,
        DateTimeOffset? ValidTo,
        DateTimeOffset CreatedAt);

    private sealed record ClientAttendanceHistoryEntryResponse(
        Guid Id,
        DateOnly TrainingDate,
        bool IsPresent,
        Guid GroupId,
        string GroupName,
        string? GroupTrainingStartTime,
        string? GroupScheduleText);

    private sealed record ClientAuditState(
        Guid Id,
        string? LastName,
        string? FirstName,
        string? MiddleName,
        string Phone,
        string Status,
        IReadOnlyList<ClientContactAuditState> Contacts,
        IReadOnlyList<Guid> GroupIds,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record ClientContactAuditState(
        string Type,
        string FullName,
        string Phone);

    private sealed record PurchaseClientMembershipRequest(
        string? MembershipType,
        string? PurchaseDate,
        string? ExpirationDate,
        decimal? PaymentAmount,
        bool? IsPaid);

    private sealed record RenewClientMembershipRequest(
        string? MembershipType,
        string? RenewalDate,
        string? ExpirationDate,
        decimal? PaymentAmount,
        bool? IsPaid);

    private sealed record CorrectClientMembershipRequest(
        string? MembershipType,
        string? PurchaseDate,
        string? ExpirationDate,
        decimal? PaymentAmount,
        bool? IsPaid);

    private sealed record MarkMembershipPaymentRequest(
        string? MembershipType,
        decimal? PaymentAmount,
        bool? IsPaid);

    private sealed record ClientMembershipAuditState(
        Guid Id,
        Guid ClientId,
        string MembershipType,
        DateOnly PurchaseDate,
        DateOnly? ExpirationDate,
        decimal PaymentAmount,
        bool IsPaid,
        bool SingleVisitUsed,
        Guid? PaidByUserId,
        DateTimeOffset? PaidAt,
        string ChangeReason,
        Guid ChangedByUserId,
        DateTimeOffset ValidFrom,
        DateTimeOffset? ValidTo,
        DateTimeOffset CreatedAt);

    private enum ClientPaymentStatus
    {
        Paid,
        Unpaid
    }
}
