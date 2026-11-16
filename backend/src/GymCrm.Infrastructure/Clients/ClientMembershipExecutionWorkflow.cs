using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static GymCrm.Infrastructure.Clients.ClientMutationPersistence;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipExecutionWorkflow(
    GymCrmDbContext dbContext,
    IAuditLogService auditLogService,
    IServiceScopeFactory serviceScopeFactory,
    ILoggerFactory loggerFactory) : IClientMembershipExecutionWorkflow
{
    public async Task<ClientMutationExecutionResult<ClientMembershipMutationError>> ExecuteAsync(
        ClientMembershipExecutionOperation operation, CancellationToken cancellationToken)
    {
        var id = operation.ClientId;
        var currentUser = operation.Actor;
        var actionType = operation.ActionType;
        var validateRequest = operation.ValidateRequest;
        var validateLockedAsync = operation.ValidateLockedAsync;
        var executeAsync = operation.ExecuteAsync;
        var lockGroupIds = operation.LockGroupIds;
        var lockBranchIds = operation.LockBranchIds;

        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return actionType == ClientMutationActionNames.ClientTransferred &&
                await IsCompletedTransferReplayAsync(id, currentUser.Id, operation.IdempotencyKey, operation.CreateIdempotencyPayload(), cancellationToken)
                ? new(ClientMutationExecutionStatus.CompletedWithoutVisibleClient)
                : new(ClientMutationExecutionStatus.NotFound);
        }

        var clientBefore = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return new(ClientMutationExecutionStatus.NotFound);
        }

        var validationErrors = validateRequest(clientBefore);
        if (validationErrors.Count > 0)
        {
            return new(ClientMutationExecutionStatus.InvalidRequest, ValidationErrors: validationErrors);
        }

        var idempotencyKey = operation.IdempotencyKey;
        if (idempotencyKey is null)
        {
            return new(ClientMutationExecutionStatus.MissingIdempotencyKey);
        }

        var payloadHash = ComputeMembershipIdempotencyPayloadHash(operation.CreateIdempotencyPayload());
        var now = DateTimeOffset.UtcNow;
        var logger = loggerFactory.CreateLogger("GymCrm.Api.Auth.ClientMembershipMutation");
        async Task<ClientMutationExecutionResult<ClientMembershipMutationError>?> HandleExistingIdempotencyAsync(
            ClientMembershipIdempotencyRecord record)
        {
            // Pending is a status-only response: do not wait on the winning operation's client write lock.
            // Completed replay and expiry cleanup still serialize with client transfer before reading or writing.
            await using var replayLease = await ClientAccessTransaction.BeginReadAsync(dbContext, currentUser.Id, [], cancellationToken);
            if (record.ExpiresAt <= now || string.Equals(record.Status, MembershipIdempotencyCompleted, StringComparison.Ordinal))
            {
                await ClientAccessTransaction.LockReadClientsAsync(dbContext, [id], cancellationToken);
            }
            var replayActor = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
            if (replayActor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, replayActor, id, cancellationToken))
            {
                return actionType == ClientMutationActionNames.ClientTransferred &&
                    IsCompletedTransferRecord(record, id, currentUser.Id, payloadHash, now)
                    ? new(ClientMutationExecutionStatus.CompletedWithoutVisibleClient)
                    : new(ClientMutationExecutionStatus.NotFound);
            }
            if (record.ExpiresAt <= now)
            {
                dbContext.ClientMembershipIdempotencyRecords.Remove(record);
                await dbContext.SaveChangesAsync(cancellationToken);
                if (replayLease is not null) await replayLease.CommitAsync(cancellationToken);
                return null;
            }

            if (record.ClientId != id ||
                !string.Equals(record.PayloadHash, payloadHash, StringComparison.Ordinal) ||
                !string.Equals(record.ActionType, actionType, StringComparison.Ordinal))
            {
                return new(ClientMutationExecutionStatus.IdempotencyConflict);
            }

            if (!string.Equals(record.Status, MembershipIdempotencyCompleted, StringComparison.Ordinal))
            {
                return new(ClientMutationExecutionStatus.InProgress);
            }

            var replayClient = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found during membership idempotency replay.");
            return new(ClientMutationExecutionStatus.Success, replayClient, IsReplay: true);
        }

        var existingIdempotency = await dbContext.ClientMembershipIdempotencyRecords
            .SingleOrDefaultAsync(
                record =>
                    record.ActorUserId == currentUser.Id &&
                    record.IdempotencyKey == idempotencyKey,
                cancellationToken);
        if (existingIdempotency is not null)
        {
            var existingResult = await HandleExistingIdempotencyAsync(existingIdempotency);
            if (existingResult is not null)
            {
                return existingResult;
            }
        }

        var reservedIdempotency = new ClientMembershipIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            ActorUserId = currentUser.Id,
            IdempotencyKey = idempotencyKey,
            ActionType = actionType,
            PayloadHash = payloadHash,
            Status = MembershipIdempotencyPending,
            ClientId = id,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now.AddDays(7)
        };
        dbContext.ClientMembershipIdempotencyRecords.Add(reservedIdempotency);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsMembershipIdempotencyUniqueException(exception))
        {
            dbContext.ChangeTracker.Clear();
            var winningRecord = await dbContext.ClientMembershipIdempotencyRecords
                .SingleAsync(
                    record =>
                        record.ActorUserId == currentUser.Id &&
                        record.IdempotencyKey == idempotencyKey,
                    cancellationToken);
            var winningResult = await HandleExistingIdempotencyAsync(winningRecord);
            if (winningResult is not null)
            {
                return winningResult;
            }

            return new(ClientMutationExecutionStatus.InProgress);
        }

        Task DeleteReservedIdempotencyAsync() => DeletePendingMembershipReservationAsync(reservedIdempotency.Id, serviceScopeFactory);

        IDbContextTransaction? transaction = null;
        async Task RollbackAndDisposeTransactionAsync()
        {
            if (transaction is not null)
            {
                var transactionToRollback = transaction;
                transaction = null;
                try
                {
                    await RollbackMembershipActionTransactionAsync(transactionToRollback, CancellationToken.None);
                }
                finally
                {
                    await transactionToRollback.DisposeAsync();
                }
            }
        }

        try
        {
            transaction = await ClientAccessTransaction.BeginMutationAsync(dbContext, currentUser.Id, id, lockGroupIds ?? [], lockBranchIds ?? [], cancellationToken);

            var lockedActor = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
            if (lockedActor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, lockedActor, id, cancellationToken))
            {
                await RollbackAndDisposeTransactionAsync();
                await DeleteReservedIdempotencyAsync();
                return new(ClientMutationExecutionStatus.NotFound);
            }
            currentUser = lockedActor;
            clientBefore = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException("Locked client disappeared.");
            validationErrors = validateLockedAsync is null ? validateRequest(clientBefore) : await validateLockedAsync();
            if (validationErrors.Count > 0)
            {
                await RollbackAndDisposeTransactionAsync();
                await DeleteReservedIdempotencyAsync();
                return new(ClientMutationExecutionStatus.InvalidRequest, ValidationErrors: validationErrors);
            }
            var mutationResult = await executeAsync(currentUser);
            if (!mutationResult.Succeeded)
            {
                await RollbackAndDisposeTransactionAsync();
                await DeleteReservedIdempotencyAsync();
                if (mutationResult.Error == ClientMembershipMutationError.ClientMissing)
                {
                    return new(ClientMutationExecutionStatus.NotFound);
                }

                return new(ClientMutationExecutionStatus.Rejected, Failure: mutationResult.Error);
            }

            var clientAfter = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership change.");
            var operationMembership = mutationResult.Details?.CurrentMembership;

            foreach (var entry in operation.CreateAuditEntries(currentUser, clientBefore, clientAfter, mutationResult))
            {
                await auditLogService.WriteAsync(entry, cancellationToken);
            }

            var idempotency = await dbContext.ClientMembershipIdempotencyRecords.SingleAsync(
                record =>
                    record.ActorUserId == currentUser.Id &&
                    record.IdempotencyKey == idempotencyKey,
                cancellationToken);
            idempotency.Status = MembershipIdempotencyCompleted;
            idempotency.ResultMembershipId = operationMembership?.Id;
            idempotency.ResultSaleId = operationMembership?.SaleId;
            idempotency.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            await CommitMembershipActionTransactionAsync(transaction, cancellationToken);
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
                transaction = null;
            }


        }
        catch (Exception exception)
        {
            await RollbackAndDisposeTransactionAsync();
            await DeleteReservedIdempotencyAsync();
            logger.LogError(
                "Membership operation failed before commit. ActionType: {ActionType}; ExceptionType: {ExceptionType}",
                actionType,
                exception.GetType().Name);
            return new(ClientMutationExecutionStatus.Failed);
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
        await using var responseLease = await ClientAccessTransaction.BeginReadAsync(dbContext, currentUser.Id, [id], cancellationToken);
        var responseActor = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
        if (responseActor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, responseActor, id, cancellationToken))
        {
            return actionType == ClientMutationActionNames.ClientTransferred ? new(ClientMutationExecutionStatus.CompletedWithoutVisibleClient) : new(ClientMutationExecutionStatus.NotFound);
        }
        var responseClient = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken);
        return responseClient is null ? new(ClientMutationExecutionStatus.NotFound) : new(ClientMutationExecutionStatus.Success, responseClient);
    }

    public async Task<bool> IsCompletedTransferReplayAsync(
        Guid clientId, Guid actorId, string? key, object payload, CancellationToken cancellationToken)
    {
        if (key is null) return false;
        var record = await dbContext.ClientMembershipIdempotencyRecords.AsNoTracking().SingleOrDefaultAsync(
            candidate => candidate.ActorUserId == actorId && candidate.IdempotencyKey == key, cancellationToken);
        return record is not null && IsCompletedTransferRecord(record, clientId, actorId,
            ComputeMembershipIdempotencyPayloadHash(payload), DateTimeOffset.UtcNow);
    }

    private static bool IsCompletedTransferRecord(ClientMembershipIdempotencyRecord record, Guid clientId, Guid actorId, string payloadHash, DateTimeOffset now) =>
        record.ActorUserId == actorId && record.ClientId == clientId && record.ExpiresAt > now &&
        record.Status == MembershipIdempotencyCompleted && record.ActionType == ClientMutationActionNames.ClientTransferred &&
        string.Equals(record.PayloadHash, payloadHash, StringComparison.Ordinal);

}
