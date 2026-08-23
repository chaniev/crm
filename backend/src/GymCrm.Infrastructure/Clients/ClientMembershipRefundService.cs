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

        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
        var sale = await dbContext.ClientMembershipSales
            .Include(candidate => candidate.Refunds)
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
        await dbContext.SaveChangesAsync(cancellationToken);
        await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipRefundMutationResult.Success(
            await detailsReader.LoadRequiredAsync(clientId, cancellationToken),
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

        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
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
            await detailsReader.LoadRequiredAsync(clientId, cancellationToken),
            ClientMembershipDetailsReader.MapRefundSnapshot(refund),
            previousRefund);
    }
}
