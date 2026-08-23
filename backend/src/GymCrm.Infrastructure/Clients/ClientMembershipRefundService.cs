using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipRefundService(
    GymCrmDbContext dbContext,
    TimeProvider timeProvider,
    IBusinessDateProvider businessDateProvider,
    ClientMembershipDetailsReader detailsReader,
    ClientMembershipQueryStore queryStore)
{
    public async Task<ClientMembershipRefundMutationResult> RegisterRefundAsync(
        Guid clientId,
        RegisterClientMembershipRefundCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.SaleId == Guid.Empty ||
            command.RefundDate == default ||
            !RubMoneyPolicy.IsWholeAmount(command.Amount, allowZero: false) ||
            command.Comment?.Length > ClientMembershipRefund.CommentMaxLength)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.ClientMissing);
        }

        var today = businessDateProvider.Today;
        if (command.RefundDate > today)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateInFuture);
        }

        var targetGroupIds = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership => membership.SaleId == command.SaleId && membership.ValidTo == null)
            .SelectMany(membership => membership.TargetGroups)
            .OrderBy(target => target.Position)
            .Select(target => target.GroupId)
            .ToArrayAsync(cancellationToken);
        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
        await queryStore.LockRefundMutationRowsAsync(clientId, command.SaleId, targetGroupIds, cancellationToken);
        var sale = await dbContext.ClientMembershipSales
            .Include(candidate => candidate.Refunds)
            .Include(candidate => candidate.Memberships)
                .ThenInclude(membership => membership.TargetGroups)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == command.SaleId && candidate.ClientId == clientId,
                cancellationToken);

        if (sale is null)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.SaleMissing);
        }

        if (command.RefundDate < sale.PurchaseDate)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateBeforePurchaseDate);
        }

        var saleCreatedDate = DateOnly.FromDateTime(sale.CreatedAt.UtcDateTime.Date);
        if (command.RefundDate < saleCreatedDate)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateBeforeSaleCreatedDate);
        }

        var refundedAmount = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .Sum(refund => refund.Amount);
        if (refundedAmount + command.Amount > sale.GrossAmount)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundAmountExceedsGrossAmount);
        }

        var now = timeProvider.GetUtcNow();
        var refund = new ClientMembershipRefund
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            ClientId = clientId,
            Amount = command.Amount,
            RefundDate = command.RefundDate,
            Comment = string.IsNullOrWhiteSpace(command.Comment) ? null : command.Comment.Trim(),
            CreatedByUserId = command.ChangedByUserId,
            CreatedAt = now
        };

        dbContext.ClientMembershipRefunds.Add(refund);
        var currentTargets = sale.Memberships
            .Where(membership => membership.ValidTo is null)
            .SingleOrDefault()
            ?.TargetGroups
            .OrderBy(target => target.Position)
            .ToArray() ?? [];
        foreach (var snapshot in ClientMembershipMutationRules.CreateRefundTargetSnapshots(refund.Id, currentTargets))
        {
            refund.TargetSnapshots.Add(snapshot);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipRefundMutationResult.Success(
            await detailsReader.LoadRequiredForSaleAsync(clientId, sale.Id, cancellationToken),
            ClientMembershipDetailsReader.MapRefundSnapshot(refund));
    }

    public async Task<ClientMembershipRefundMutationResult> CancelRefundAsync(
        Guid clientId,
        CancelClientMembershipRefundCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.RefundId == Guid.Empty)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.ClientMissing);
        }

        var refundIdentity = await dbContext.ClientMembershipRefunds
            .AsNoTracking()
            .Where(candidate => candidate.Id == command.RefundId && candidate.ClientId == clientId)
            .Select(candidate => new { candidate.SaleId })
            .SingleOrDefaultAsync(cancellationToken);
        if (refundIdentity is null)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundMissing);
        }

        var targetGroupIds = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership => membership.SaleId == refundIdentity.SaleId && membership.ValidTo == null)
            .SelectMany(membership => membership.TargetGroups)
            .OrderBy(target => target.Position)
            .Select(target => target.GroupId)
            .ToArrayAsync(cancellationToken);
        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
        await queryStore.LockRefundMutationRowsAsync(clientId, refundIdentity.SaleId, targetGroupIds, cancellationToken);
        var refund = await dbContext.ClientMembershipRefunds
            .SingleOrDefaultAsync(
                candidate => candidate.Id == command.RefundId && candidate.ClientId == clientId,
                cancellationToken);

        if (refund is null)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundMissing);
        }

        if (refund.CanceledAt is not null)
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundAlreadyCanceled);
        }

        var previousRefund = ClientMembershipDetailsReader.MapRefundSnapshot(refund);
        refund.CanceledAt = DateTimeOffset.UtcNow;
        refund.CanceledByUserId = command.ChangedByUserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipRefundMutationResult.Success(
            await detailsReader.LoadRequiredForSaleAsync(clientId, refund.SaleId, cancellationToken),
            ClientMembershipDetailsReader.MapRefundSnapshot(refund),
            previousRefund);
    }
}
