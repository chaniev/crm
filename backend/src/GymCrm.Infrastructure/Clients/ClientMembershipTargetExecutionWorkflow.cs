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

internal sealed class ClientMembershipTargetExecutionWorkflow(
    GymCrmDbContext dbContext,
    IAuditLogService auditLogService,
    IServiceScopeFactory serviceScopeFactory,
    ILoggerFactory loggerFactory) : IClientMembershipTargetExecutionWorkflow
{
    public async Task<ClientMutationExecutionResult<ClientMembershipTargetTransferResult>> ExecuteAsync(
        ClientMembershipTargetExecutionOperation operation, CancellationToken cancellationToken)
    {
        var id = operation.ClientId;
        var currentUser = operation.Actor;

        if (!await ClientAccessTransaction.CanAccessAsync(dbContext, currentUser, id, cancellationToken))
        {
            return new(ClientMutationExecutionStatus.NotFound);
        }

        var clientBefore = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken);
        if (clientBefore is null)
        {
            return new(ClientMutationExecutionStatus.NotFound);
        }

        var idempotencyKey = operation.IdempotencyKey;
        if (idempotencyKey is null)
        {
            return new(ClientMutationExecutionStatus.MissingIdempotencyKey);
        }

        var actionType = operation.ActionType;
        var payloadHash = ComputeMembershipIdempotencyPayloadHash(operation.CreateIdempotencyPayload());
        var now = DateTimeOffset.UtcNow;
        var logger = loggerFactory.CreateLogger("GymCrm.Api.Auth.ClientMembershipTargetTransfer");

        async Task<ClientMutationExecutionResult<ClientMembershipTargetTransferResult>?> HandleExistingIdempotencyAsync(ClientMembershipIdempotencyRecord record)
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
                return new(ClientMutationExecutionStatus.NotFound);
            }
            if (record.ExpiresAt <= now)
            {
                dbContext.ClientMembershipIdempotencyRecords.Remove(record);
                await dbContext.SaveChangesAsync(cancellationToken);
                if (replayLease is not null) await replayLease.CommitAsync(cancellationToken);
                return null;
            }

            if (record.ClientId != id || !string.Equals(record.PayloadHash, payloadHash, StringComparison.Ordinal) ||
                !string.Equals(record.ActionType, actionType, StringComparison.Ordinal))
            {
                return new(ClientMutationExecutionStatus.IdempotencyConflict);
            }

            if (!string.Equals(record.Status, MembershipIdempotencyCompleted, StringComparison.Ordinal))
            {
                return new(ClientMutationExecutionStatus.InProgress);
            }

            var replayClient = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found during membership target transfer replay.");
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

        var reservedRecordId = Guid.NewGuid();
        dbContext.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
        {
            Id = reservedRecordId,
            ActorUserId = currentUser.Id,
            IdempotencyKey = idempotencyKey,
            ActionType = actionType,
            PayloadHash = payloadHash,
            Status = MembershipIdempotencyPending,
            ClientId = id,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now.AddDays(7)
        });
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
            return winningResult ?? new(ClientMutationExecutionStatus.InProgressAfterReservationCollision);
        }

        Task DeleteReservedIdempotencyAsync() => DeletePendingMembershipReservationAsync(reservedRecordId, serviceScopeFactory);

        IDbContextTransaction? transaction = null;
        try
        {
            transaction = await ClientAccessTransaction.BeginMutationAsync(dbContext, currentUser.Id, id,
            operation.LockGroupIds, [], cancellationToken);

            var lockedActor = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
            if (lockedActor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, lockedActor, id, cancellationToken))
            {
                await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
                if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
                await DeleteReservedIdempotencyAsync();
                return new(ClientMutationExecutionStatus.NotFound);
            }
            currentUser = lockedActor;
            var transfer = await operation.ExecuteAsync(currentUser);
            if (!transfer.Succeeded)
            {
                await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
                if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
                await DeleteReservedIdempotencyAsync();
                return new(ClientMutationExecutionStatus.Rejected, Failure: transfer);
            }

            var clientAfter = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Updated client '{id}' was not found after membership target transfer.");
            await auditLogService.WriteAsync(operation.CreateAuditEntry(currentUser, clientBefore, clientAfter), cancellationToken);

            var idempotency = await dbContext.ClientMembershipIdempotencyRecords.SingleAsync(
                record =>
                    record.ActorUserId == currentUser.Id &&
                    record.IdempotencyKey == idempotencyKey,
                cancellationToken);
            idempotency.Status = MembershipIdempotencyCompleted;
            idempotency.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            await CommitMembershipActionTransactionAsync(transaction, cancellationToken);
            if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
            var responseClient = await ClientSnapshotReader.LoadAuthorizedAsync(id, currentUser.Id, dbContext, cancellationToken);
            if (responseClient is null) return new(ClientMutationExecutionStatus.NotFound);

            return new(ClientMutationExecutionStatus.Success, responseClient, ReservationId: reservedRecordId);
        }
        catch (Exception exception)
        {
            await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
            if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
            await DeleteReservedIdempotencyAsync();
            logger.LogError(
                "Membership target transfer failed before commit. ExceptionType: {ExceptionType}",
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
    }

    public Task CleanupFailedResultAsync(Guid? reservationId) =>
        DeletePendingMembershipReservationAsync(reservationId, serviceScopeFactory);
}
