using GymCrm.Application.Audit;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using static GymCrm.Infrastructure.Clients.ClientMutationPersistence;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipRefundExecutionWorkflow(
    GymCrmDbContext dbContext,
    IAuditLogService auditLogService,
    IServiceScopeFactory serviceScopeFactory) : IClientMembershipRefundExecutionWorkflow
{
    public async Task<ClientMutationExecutionResult<ClientMembershipRefundMutationError>> ExecuteAsync(
        ClientMembershipRefundExecutionOperation operation, CancellationToken cancellationToken)
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

        var validationErrors = operation.ValidateRequest?.Invoke() ?? [];
        if (validationErrors.Count > 0)
        {
            return new(ClientMutationExecutionStatus.InvalidRequest, ValidationErrors: validationErrors);
        }

        var idempotencyKey = operation.IdempotencyKey;
        if (idempotencyKey is null)
        {
            return new(ClientMutationExecutionStatus.MissingIdempotencyKey);
        }

        var actionType = operation.ActionType;
        var reservation = await ReserveRefundIdempotencyAsync(
            currentUser.Id,
            id,
            idempotencyKey,
            actionType,
            operation.CreateIdempotencyPayload(),
            dbContext,
            cancellationToken);
        if (reservation.Failure is not null)
        {
            return new(reservation.Failure.Value);
        }

        if (reservation.IsReplay)
        {
            var replayClient = await ClientSnapshotReader.LoadAuthorizedAsync(id, currentUser.Id, dbContext, cancellationToken);
            if (replayClient is null) return new(ClientMutationExecutionStatus.NotFound);
            return new(ClientMutationExecutionStatus.Success, replayClient, IsReplay: true);
        }

        IDbContextTransaction? transaction = null;
        try
        {
            transaction = await ClientAccessTransaction.BeginMutationAsync(dbContext, currentUser.Id, id, [], [], cancellationToken);

            var lockedActor = await ClientAccessTransaction.LoadActorAsync(dbContext, currentUser.Id, cancellationToken);
            if (lockedActor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, lockedActor, id, cancellationToken))
            {
                await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
                if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
                await DeletePendingMembershipReservationAsync(reservation.RecordId, serviceScopeFactory);
                return new(ClientMutationExecutionStatus.NotFound);
            }
            currentUser = lockedActor;
            var mutationResult = await operation.ExecuteAsync(currentUser);

            if (!mutationResult.Succeeded)
            {
                await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
                if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
                await DeletePendingMembershipReservationAsync(reservation.RecordId, serviceScopeFactory);
                return new(ClientMutationExecutionStatus.Rejected, Failure: mutationResult.Error);
            }

            var clientAfter = await ClientSnapshotReader.LoadAsync(id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException(operation.RequestedSaleId.HasValue
                    ? $"Updated client '{id}' was not found after membership refund registration."
                    : $"Updated client '{id}' was not found after membership refund cancellation.");
            var refund = mutationResult.Refund
                ?? throw new InvalidOperationException(operation.RequestedSaleId.HasValue
                    ? "Membership refund mutation succeeded without a refund snapshot."
                    : "Membership refund cancellation succeeded without a refund snapshot.");

            await auditLogService.WriteAsync(operation.CreateAuditEntry(currentUser, clientAfter, mutationResult), cancellationToken);
            await CompleteRefundIdempotencyAsync(
                currentUser.Id, idempotencyKey, refund.Id, operation.RequestedSaleId ?? refund.SaleId, dbContext, cancellationToken);
            await CommitMembershipActionTransactionAsync(transaction, cancellationToken);
            if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
            var responseClient = await ClientSnapshotReader.LoadAuthorizedAsync(id, currentUser.Id, dbContext, cancellationToken);
            if (responseClient is null) return new(ClientMutationExecutionStatus.NotFound);

            return new(ClientMutationExecutionStatus.Success, responseClient, ReservationId: reservation.RecordId);
        }
        catch
        {
            await RollbackMembershipActionTransactionAsync(transaction, CancellationToken.None);
            if (transaction is not null) { await transaction.DisposeAsync(); transaction = null; }
            await DeletePendingMembershipReservationAsync(reservation.RecordId, serviceScopeFactory);
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

    private static async Task<ClientMembershipRefundReservation> ReserveRefundIdempotencyAsync(
        Guid actorUserId,
        Guid clientId,
        string idempotencyKey,
        string actionType,
        object payload,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await using var lease = await ClientAccessTransaction.BeginReadAsync(dbContext, actorUserId, [clientId], cancellationToken);
        var actor = await ClientAccessTransaction.LoadActorAsync(dbContext, actorUserId, cancellationToken);
        if (actor is null || !await ClientAccessTransaction.CanAccessAsync(dbContext, actor, clientId, cancellationToken))
            return new ClientMembershipRefundReservation(false, ClientMutationExecutionStatus.NotFound);
        var now = DateTimeOffset.UtcNow;
        var payloadHash = ComputeMembershipIdempotencyPayloadHash(payload);
        var existing = await dbContext.ClientMembershipIdempotencyRecords.SingleOrDefaultAsync(
            record => record.ActorUserId == actorUserId && record.IdempotencyKey == idempotencyKey,
            cancellationToken);
        if (existing is not null && existing.ExpiresAt <= now)
        {
            dbContext.ClientMembershipIdempotencyRecords.Remove(existing);
            await dbContext.SaveChangesAsync(cancellationToken);
            existing = null;
        }

        ClientMembershipRefundReservation MapExisting(ClientMembershipIdempotencyRecord record)
        {
            if (!string.Equals(record.ActionType, actionType, StringComparison.Ordinal) ||
                !string.Equals(record.PayloadHash, payloadHash, StringComparison.Ordinal))
            {
                return new ClientMembershipRefundReservation(false, ClientMutationExecutionStatus.IdempotencyConflict);
            }

            return string.Equals(record.Status, MembershipIdempotencyCompleted, StringComparison.Ordinal)
                ? new ClientMembershipRefundReservation(true, null)
                : new ClientMembershipRefundReservation(false, ClientMutationExecutionStatus.InProgress);
        }

        if (existing is not null)
        {
            if (lease is not null) await lease.CommitAsync(cancellationToken);
            return MapExisting(existing);
        }

        var reservedRecordId = Guid.NewGuid();
        dbContext.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
        {
            Id = reservedRecordId,
            ActorUserId = actorUserId,
            IdempotencyKey = idempotencyKey,
            ActionType = actionType,
            PayloadHash = payloadHash,
            Status = MembershipIdempotencyPending,
            ClientId = clientId,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now.AddDays(7)
        });
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            if (lease is not null) await lease.CommitAsync(cancellationToken);
            return new ClientMembershipRefundReservation(false, null, reservedRecordId);
        }
        catch (DbUpdateException exception) when (IsMembershipIdempotencyUniqueException(exception))
        {
            if (lease is not null) { await lease.RollbackAsync(CancellationToken.None); await lease.DisposeAsync(); }
            dbContext.ChangeTracker.Clear();
            var winner = await dbContext.ClientMembershipIdempotencyRecords.SingleAsync(
                record => record.ActorUserId == actorUserId && record.IdempotencyKey == idempotencyKey,
                cancellationToken);
            return MapExisting(winner);
        }
    }

    private static async Task CompleteRefundIdempotencyAsync(
        Guid actorUserId,
        string idempotencyKey,
        Guid refundId,
        Guid saleId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var record = await dbContext.ClientMembershipIdempotencyRecords.SingleAsync(
            candidate => candidate.ActorUserId == actorUserId && candidate.IdempotencyKey == idempotencyKey,
            cancellationToken);
        record.Status = MembershipIdempotencyCompleted;
        record.ResultMembershipId = refundId;
        record.ResultSaleId = saleId;
        record.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

}
