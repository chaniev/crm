using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;
using static GymCrm.Api.Auth.ClientLifecycleRequestValidation;
using static GymCrm.Api.Auth.ClientMembershipEndpoints;

namespace GymCrm.Api.Auth;

internal static class ClientLifecycleEndpoints
{
    internal static RouteGroupBuilder MapClientLifecycleEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/", CreateClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        MapUpdate(group, "/{id:guid}", ClientUpdateSection.Full);
        MapUpdate(group, "/{id:guid}/profile", ClientUpdateSection.Profile);
        MapUpdate(group, "/{id:guid}/groups", ClientUpdateSection.Groups);
        group.MapPost("/{id:guid}/transfer", TransferClientBranchAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/archive", ArchiveClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        group.MapPut("/{id:guid}/restore", RestoreClientAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);

        return group;
    }

    private static void MapUpdate(RouteGroupBuilder group, string pattern, ClientUpdateSection section)
    {
        group.MapPut(pattern, (Guid id, HttpContext httpContext, GymCrmDbContext dbContext,
                IBusinessDateProvider businessDateProvider, IAuditLogService auditLogService,
                ILoggerFactory loggerFactory, IAntiforgery antiforgery, CancellationToken cancellationToken) =>
                UpdateClientAsync(id, section, httpContext, dbContext, businessDateProvider,
                    auditLogService, loggerFactory, antiforgery, cancellationToken))
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
    }

    private static async Task<Results<Created<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateClientAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IClientCreationWriter creationWriter,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var (request, bindingProblem) = await ReadClientWriteRequestAsync(
            httpContext.Request, ClientUpdateSection.Full,
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

        var normalizedRequest = request!;
        if (!ClientAccessPolicy.CanAccessBranch(currentUser, normalizedRequest.BranchId))
        {
            return StaffProblemDetails.FromDenial(StaffAuthorizationDenial.BranchScopeForbidden);
        }
        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(
            dbContext, currentUser.Id, null, normalizedRequest.GroupIds,
            normalizedRequest.BranchId is Guid branchId ? [branchId] : [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }
        if (!ClientAccessPolicy.CanAccessBranch(currentUser, normalizedRequest.BranchId))
        {
            return StaffProblemDetails.FromDenial(StaffAuthorizationDenial.BranchScopeForbidden);
        }
        var validationErrors = await ValidateUpsertRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var client = await creationWriter.WriteAsync(new ClientCreationData(
            normalizedRequest.LastName, normalizedRequest.FirstName, normalizedRequest.MiddleName,
            normalizedRequest.Phone, normalizedRequest.BranchId!.Value, normalizedRequest.BirthDate,
            normalizedRequest.Notes, normalizedRequest.GroupIds,
            normalizedRequest.Contacts.Select(contact => new ClientContact
            { Type = contact.Type, FullName = contact.FullName, Phone = contact.Phone }).ToArray(),
            normalizedRequest.TelegramContactUsername), currentUser, cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            await transaction.DisposeAsync();
        }
        var responseClient = await LoadAuthorizedMutationSnapshotAsync(client.Id, currentUser.Id, dbContext, cancellationToken);
        return responseClient is null ? TypedResults.NotFound() : TypedResults.Created($"/clients/{client.Id}", ClientResponseMapper.MapDetails(responseClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateClientAsync(
        Guid id,
        ClientUpdateSection section,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IAuditLogService auditLogService,
        ILoggerFactory loggerFactory,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var (request, bindingProblem) = await ReadClientWriteRequestAsync(
            httpContext.Request, section,
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

        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = request!;
        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(
            dbContext, currentUser.Id, id, normalizedRequest.GroupIds,
            normalizedRequest.BranchId is Guid branchId ? [branchId] : [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return TypedResults.NotFound();
        }

        var client = await LoadClientForMutationAsync(id, dbContext, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        if (section != ClientUpdateSection.Full)
        {
            normalizedRequest = normalizedRequest with { BranchId = client.BranchId };
        }

        var validationErrors = await ValidateUpsertRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            client.BranchId,
            section);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldStateSnapshot = await ClientResponseMapper.LoadClientSnapshotAsync(id, dbContext, cancellationToken);
        var oldState = SerializeAuditState(oldStateSnapshot ?? client);

        var now = DateTimeOffset.UtcNow;
        string? noteTransition = null;
        if (section != ClientUpdateSection.Groups)
        {
            client.LastName = normalizedRequest.LastName;
            client.FirstName = normalizedRequest.FirstName;
            client.MiddleName = normalizedRequest.MiddleName;
            client.Phone = normalizedRequest.Phone;
            client.BirthDate = normalizedRequest.BirthDate;
            if (section == ClientUpdateSection.Profile)
            {
                client.TelegramContactUsername = normalizedRequest.TelegramContactUsername;
            }
            noteTransition = ClientNotesMetadataPolicy.Apply(client, normalizedRequest.Notes, currentUser.Id, now);
            await ReplaceContactsAsync(client.Id, normalizedRequest.Contacts, dbContext, cancellationToken);
        }
        if (section != ClientUpdateSection.Profile)
        {
            await ReplaceGroupAssignmentsAsync(
                client.Id, client.BranchId, normalizedRequest.GroupIds, currentUser.Id, now,
                businessDateProvider.Today, dbContext, cancellationToken);
        }
        client.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        var updatedClient = await ClientResponseMapper.LoadClientSnapshotAsync(client.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated client '{client.Id}' was not found.");

        await WriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
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
            await WriteClientAuditAsync(auditLogService, dbContext, loggerFactory, currentUser.Id, client.Id,
                BuildNoteAuditEntry(currentUser.Id, client, currentUser.Login, noteTransition), cancellationToken);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            await transaction.DisposeAsync();
        }
        var responseClient = await LoadAuthorizedMutationSnapshotAsync(id, currentUser.Id, dbContext, cancellationToken);
        return responseClient is null ? TypedResults.NotFound() : TypedResults.Ok(ClientResponseMapper.MapDetails(responseClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }

    private static async Task<Results<Ok<ClientDetailsResponse>, NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> TransferClientBranchAsync(
        Guid id,
        TransferClientBranchRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IBusinessDateProvider businessDateProvider,
        IClientMembershipExecutionWorkflow executionWorkflow,
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

        var targetGroupIds = NormalizeTransferGroupIds(request);
        var transferPayload = new
        {
            ClientId = id,
            Action = ClientAuditConstants.ClientTransferredAction,
            TargetBranchId = request.TargetBranchId,
            TargetGroupIds = targetGroupIds.Order().ToArray()
        };
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return await executionWorkflow.IsCompletedTransferReplayAsync(id, currentUser.Id, GetMembershipIdempotencyKey(httpContext.Request), transferPayload, cancellationToken)
                ? TypedResults.NoContent()
                : TypedResults.NotFound();
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

        var targetBranchId = request.TargetBranchId!.Value;

        return await ExecuteMembershipActionAsync(
            id,
            httpContext,
            executionWorkflow,
            businessDateProvider,
            antiforgery,
            cancellationToken,
            validateRequest: _ => [],
            executeAsync: async actor =>
            {
                await LockClientAssignmentTransferRowsAsync(
                    id,
                    targetGroupIds,
                    dbContext,
                    cancellationToken);

                var clientForMutation = await dbContext.Clients
                    .Include(candidate => candidate.Groups)
                    .Include(candidate => candidate.Memberships)
                        .ThenInclude(membership => membership.TargetGroups)
                    .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
                if (clientForMutation is null)
                {
                    return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
                }

                var requestedGroupIds = targetGroupIds.ToHashSet();
                var activeOrFutureTargets = clientForMutation.Memberships
                    .Where(membership => membership.ValidTo is null)
                    .Where(membership => ClientMembershipTargetPolicy.ResolveEntitlementState(
                        membership,
                        businessDateProvider.Today) is ClientMembershipEntitlementState.Active or ClientMembershipEntitlementState.Future)
                    .SelectMany(membership => membership.TargetGroups)
                    .Select(target => target.GroupId)
                    .Distinct()
                    .ToArray();
                if (activeOrFutureTargets.Any(targetGroupId => !requestedGroupIds.Contains(targetGroupId)))
                {
                    return ClientMembershipMutationResult.Failure(
                        ClientMembershipMutationError.BranchTransferMembershipTargetsAffected);
                }

                var now = DateTimeOffset.UtcNow;
                var businessDay = businessDateProvider.Today;
                clientForMutation.BranchId = targetBranchId;
                clientForMutation.UpdatedAt = now;
                await CloseActiveBranchAssignmentsAsync(clientForMutation.Id, now, businessDay, dbContext, cancellationToken);
                OpenBranchAssignment(clientForMutation.Id, targetBranchId, actor.Id, now, businessDay, dbContext);

                await ReplaceGroupAssignmentsAsync(
                    clientForMutation.Id,
                    targetBranchId,
                    targetGroupIds,
                    actor.Id,
                    now,
                    businessDay,
                    dbContext,
                    cancellationToken);

                await dbContext.SaveChangesAsync(cancellationToken);
                return ClientMembershipMutationResult.Success(new ClientMembershipDetailsResult(id, null, []));
            },
            idempotencyPayload: transferPayload,
            actionType: ClientAuditConstants.ClientTransferredAction,
            descriptionFactory: ClientAuditResources.ClientTransferredDescription,
            createAuditEntries: (actor, clientBefore, clientAfter, _) => [new AuditLogEntry(
                    actor.Id,
                    ClientAuditConstants.ClientTransferredAction,
                    ClientAuditConstants.ClientEntityType,
                    clientAfter.Id.ToString(),
                    ClientAuditResources.ClientTransferredDescription(
                        actor.Login,
                        BuildClientFullName(clientAfter.LastName, clientAfter.FirstName, clientAfter.MiddleName)),
                    SerializeAuditState(clientBefore),
                    SerializeAuditState(clientAfter))],
            lockGroupIds: targetGroupIds,
            lockBranchIds: [targetBranchId],
            validateLockedAsync: () => ValidateTransferRequestAsync(request, dbContext, cancellationToken));
    }

    private static async Task LockClientAssignmentTransferRowsAsync(
        Guid clientId,
        IReadOnlyList<Guid> targetGroupIds,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        foreach (var groupId in targetGroupIds.Order())
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""",
                cancellationToken);
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Clients" WHERE "Id" = {clientId} FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL ORDER BY "Id" FOR UPDATE""",
            cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "ClientMembershipTargetGroups" WHERE "ClientMembershipId" IN (SELECT "Id" FROM "ClientMemberships" WHERE "ClientId" = {clientId} AND "ValidTo" IS NULL) ORDER BY "ClientMembershipId", "Position" FOR UPDATE""",
            cancellationToken);
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

        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return TypedResults.NotFound();
        }

        await using var transaction = await ClientAccessTransaction.BeginMutationAsync(
            dbContext, currentUser.Id, id, [], [], cancellationToken);
        currentUser = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }
        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return TypedResults.NotFound();
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

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
            await transaction.DisposeAsync();
        }
        var responseClient = await LoadAuthorizedMutationSnapshotAsync(id, currentUser.Id, dbContext, cancellationToken);
        return responseClient is null ? TypedResults.NotFound() : TypedResults.Ok(ClientResponseMapper.MapDetails(responseClient, ClientResponseMapper.EmptyAttendanceHistoryPage(), businessDateProvider.Today));
    }
}
