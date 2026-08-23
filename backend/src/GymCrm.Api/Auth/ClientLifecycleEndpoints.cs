using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;


namespace GymCrm.Api.Auth;

internal static partial class ClientEndpoints
{
    private static RouteGroupBuilder MapClientLifecycleEndpoints(this RouteGroupBuilder group)
    {
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

        return group;
    }

    private static async Task<Results<Created<ClientDetailsResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateClientAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var (request, bindingProblem) = await ReadUpsertClientRequestAsync(
            httpContext.Request,
            cancellationToken);
        if (bindingProblem is not null)
        {
            return bindingProblem;
        }

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

        var normalizedRequest = NormalizeRequest(request!);
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
            BirthDate = normalizedRequest.BirthDate,
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

        var createdClient = await ClientResponseMapper.LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
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

        return TypedResults.Created($"/clients/{client.Id}", ClientResponseMapper.MapDetails(createdClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var (request, bindingProblem) = await ReadUpsertClientRequestAsync(
            httpContext.Request,
            cancellationToken);
        if (bindingProblem is not null)
        {
            return bindingProblem;
        }

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

        var normalizedRequest = NormalizeRequest(request!);
        var validationErrors = await ValidateUpsertRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            client.BranchId);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldStateSnapshot = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        var oldState = SerializeAuditState(oldStateSnapshot ?? client);

        client.LastName = normalizedRequest.LastName;
        client.FirstName = normalizedRequest.FirstName;
        client.MiddleName = normalizedRequest.MiddleName;
        client.Phone = normalizedRequest.Phone;
        client.BranchId = normalizedRequest.BranchId!.Value;
        client.BirthDate = normalizedRequest.BirthDate;
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

        var updatedClient = await ClientResponseMapper.LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
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

        return TypedResults.Ok(ClientResponseMapper.MapDetails(updatedClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> TransferClientBranchAsync(
        Guid id,
        TransferClientBranchRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IClientMembershipService membershipService,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        IServiceScopeFactory serviceScopeFactory,
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

        var removedPaymentMarker = CreateRemovedPaymentMarkerProblem(request.PaymentStatus, request.IsPaid);
        if (removedPaymentMarker is not null)
        {
            return removedPaymentMarker;
        }

        var transferIdempotencyKey = GetMembershipIdempotencyKey(httpContext.Request);
        if (transferIdempotencyKey is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idempotencyKey"] = ["Idempotency-Key header is required for this membership operation."]
            });
        }

        var client = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var validationErrors = await ValidateTransferRequestAsync(request, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var targetBranchId = (request.TargetBranchId ?? request.BranchId)!.Value;
        var targetGroupIds = NormalizeTransferGroupIds(request);
        var today = businessDateProvider.Today;
        var currentMembership = ClientResponseMapper.GetCurrentMembership(client);
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
            ValidateCatalogPayment(request.PaymentStatus, request.IsPaid, request.PaymentDate, today, pricingErrors);
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

        return await ExecuteMembershipActionAsync(
            id,
            httpContext,
            dbContext,
            businessDateProvider,
            auditLogService,
            serviceScopeFactory,
            loggerFactory,
            antiforgery,
            cancellationToken,
            validateRequest: _ => [],
            executeAsync: async actor =>
            {
                var clientForMutation = await dbContext.Clients
                    .Include(candidate => candidate.Groups)
                    .Include(candidate => candidate.Memberships)
                        .ThenInclude(membership => membership.Sale)
                    .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
                if (clientForMutation is null)
                {
                    return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
                }

                var now = DateTimeOffset.UtcNow;
                var currentMembershipForMutation = ClientResponseMapper.GetCurrentMembership(clientForMutation);
                if (!preserveSingleVisit && currentMembershipForMutation is not null)
                {
                    currentMembershipForMutation.ValidTo = now;
                    if (currentMembershipForMutation.BehaviorKind is MembershipBehaviorKind.Term or MembershipBehaviorKind.Professional)
                    {
                        currentMembershipForMutation.IndividualValidTo = today.AddDays(-1);
                    }
                }

                clientForMutation.BranchId = targetBranchId;
                clientForMutation.UpdatedAt = now;
                await CloseActiveBranchAssignmentsAsync(clientForMutation.Id, now, dbContext, cancellationToken);
                OpenBranchAssignment(clientForMutation.Id, targetBranchId, actor.Id, now, dbContext);

                await ReplaceGroupAssignmentsAsync(
                    clientForMutation.Id,
                    targetBranchId,
                    targetGroupIds,
                    actor.Id,
                    now,
                    dbContext,
                    cancellationToken);

                await dbContext.SaveChangesAsync(cancellationToken);

                if (!preserveSingleVisit)
                {
                    return await membershipService.PurchaseAsync(
                        clientForMutation.Id,
                        new CreateClientMembershipPurchaseCommand(
                            actor.Id,
                            request.MembershipCatalogItemId,
                            ParseIsoDate(request.ValidFrom),
                            ParseIsoDate(request.ValidTo),
                            ParseIsoDate(request.PaymentDate)!.Value,
                            request.ProfessionalComment,
                            request.ManualSaleAmount),
                        cancellationToken);
                }

                return ClientMembershipMutationResult.Success(new ClientMembershipDetailsResult(id, null, []));
            },
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.ClientTransferredAction,
                TargetBranchId = targetBranchId,
                GroupIds = targetGroupIds.Order().ToArray(),
                PreserveSingleVisit = preserveSingleVisit,
                request.MembershipCatalogItemId,
                ValidFrom = NormalizeIsoDateForIdempotency(request.ValidFrom),
                ValidTo = NormalizeIsoDateForIdempotency(request.ValidTo),
                PaymentDate = NormalizeIsoDateForIdempotency(request.PaymentDate),
                ProfessionalComment = NormalizeOptionalText(request.ProfessionalComment),
                request.ManualSaleAmount
            },
            actionType: ClientAuditConstants.ClientTransferredAction,
            descriptionFactory: ClientAuditResources.ClientTransferredDescription,
            writeAuditAsync: (actor, clientBefore, clientAfter, _) => auditLogService.WriteAsync(
                new AuditLogEntry(
                    actor.Id,
                    ClientAuditConstants.ClientTransferredAction,
                    ClientAuditConstants.ClientEntityType,
                    clientAfter.Id.ToString(),
                    ClientAuditResources.ClientTransferredDescription(
                        actor.Login,
                        BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                    SerializeAuditState(clientBefore),
                    SerializeAuditState(clientAfter)),
                cancellationToken));
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ArchiveClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
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
            businessDateProvider,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static Task<Results<Ok<ClientDetailsResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> RestoreClientAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
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
            businessDateProvider,
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

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var clientBefore = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Client '{id}' was not found after mutation load.");

        if (client.Status == targetStatus)
        {
            return TypedResults.Ok(ClientResponseMapper.MapDetails(clientBefore, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
        }

        var oldState = SerializeAuditState(clientBefore);
        client.Status = targetStatus;
        client.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var clientAfter = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken)
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

        return TypedResults.Ok(ClientResponseMapper.MapDetails(clientAfter, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }
}
