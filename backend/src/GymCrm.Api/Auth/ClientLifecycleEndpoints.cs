using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
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
        var targetGroupIds = NormalizeTransferGroupIds(request);

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
                return ClientMembershipMutationResult.Success(new ClientMembershipDetailsResult(id, null, []));
            },
            idempotencyPayload: new
            {
                ClientId = id,
                Action = ClientAuditConstants.ClientTransferredAction,
                TargetBranchId = targetBranchId,
                TargetGroupIds = targetGroupIds.Order().ToArray()
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
