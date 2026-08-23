using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipDetailsReader(GymCrmDbContext dbContext)
{
    public async Task<ClientMembershipDetailsResult?> GetAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var memberships = await LoadMembershipsAsync(clientId, cancellationToken);
        if (memberships.Count == 0)
        {
            var clientExists = await dbContext.Clients
                .AsNoTracking()
                .AnyAsync(client => client.Id == clientId, cancellationToken);

            return clientExists
                ? new ClientMembershipDetailsResult(clientId, null, [])
                : null;
        }

        return CreateDetails(clientId, memberships);
    }

    public async Task<ClientMembershipDetailsResult> LoadRequiredAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await GetAsync(clientId, cancellationToken)
            ?? throw new InvalidOperationException($"Client membership details for '{clientId}' were not found.");
    }

    public static ClientMembershipSnapshotResult MapMembershipSnapshot(ClientMembership membership)
    {
        return new ClientMembershipSnapshotResult(
            membership.Id,
            membership.Sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
            membership.BehaviorKind,
            membership.Sale.PricingMode,
            membership.Sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
            membership.Sale.PurchaseDate,
            membership.Sale.PaymentDate,
            membership.IndividualValidTo,
            membership.IndividualValidFrom,
            membership.IndividualValidTo,
            membership.ProfessionalComment,
            membership.SingleVisitUsed,
            membership.Sale.CreatedByUserId,
            membership.Sale.CreatedAt,
            membership.ValidFrom,
            membership.ValidTo,
            membership.ChangeReason,
            membership.ChangedByUserId,
            membership.CreatedAt,
            membership.SaleId,
            membership.Sale.Comment,
            ResolveCommentAuthorName(membership.Sale),
            ResolveCommentChangedAt(membership.Sale),
            CreateFinancialSummary(membership.Sale),
            MapRefunds(membership.Sale));
    }

    public static ClientMembershipRefundSnapshotResult MapRefundSnapshot(ClientMembershipRefund refund)
    {
        return new ClientMembershipRefundSnapshotResult(
            refund.Id,
            refund.SaleId,
            refund.ClientId,
            refund.Amount,
            refund.RefundDate,
            refund.Comment,
            refund.CreatedByUserId,
            refund.CreatedAt,
            refund.CanceledAt,
            refund.CanceledByUserId);
    }

    public static ClientMembershipSaleSnapshotResult MapSaleSnapshot(ClientMembershipSale sale)
    {
        return new ClientMembershipSaleSnapshotResult(
            sale.Id,
            sale.ClientId,
            sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(sale),
            sale.BehaviorKind,
            sale.PricingMode,
            sale.PurchaseDate,
            sale.PaymentDate,
            sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(sale),
            sale.CreatedByUserId,
            sale.CreatedAt);
    }

    private async Task<List<ClientMembership>> LoadMembershipsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var memberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CreatedByUser)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.Refunds)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CommentChangedByUser)
            .Where(membership => membership.ClientId == clientId)
            .ToListAsync(cancellationToken);

        return memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ToList();
    }

    private static ClientMembershipDetailsResult CreateDetails(
        Guid clientId,
        IReadOnlyList<ClientMembership> memberships)
    {
        var history = memberships
            .Select(MapMembershipSnapshot)
            .ToArray();

        return new ClientMembershipDetailsResult(
            clientId,
            history
                .Where(membership => membership.ValidTo is null)
                .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
                .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .FirstOrDefault(),
            history);
    }

    private static string? ResolveCommentAuthorName(ClientMembershipSale sale) =>
        sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null
            ? sale.CommentChangedByUser.FullName : null;

    private static DateTimeOffset? ResolveCommentChangedAt(ClientMembershipSale sale) =>
        sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null
            ? sale.CommentChangedAt : null;

    private static ClientMembershipFinancialSummaryResult CreateFinancialSummary(ClientMembershipSale sale)
    {
        var nonCanceledRefunds = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .ToArray();
        var refundedAmount = nonCanceledRefunds.Sum(refund => refund.Amount);
        var refundStatus = refundedAmount <= 0
            ? ClientMembershipRefundStatus.None
            : refundedAmount >= sale.GrossAmount
                ? ClientMembershipRefundStatus.Full
                : ClientMembershipRefundStatus.Partial;

        return new ClientMembershipFinancialSummaryResult(
            sale.GrossAmount,
            refundedAmount,
            sale.GrossAmount - refundedAmount,
            refundStatus,
            nonCanceledRefunds
                .Select(refund => (DateOnly?)refund.RefundDate)
                .OrderByDescending(refundDate => refundDate)
                .FirstOrDefault());
    }

    private static IReadOnlyList<ClientMembershipRefundSnapshotResult> MapRefunds(ClientMembershipSale sale)
    {
        return sale.Refunds
            .OrderByDescending(refund => refund.RefundDate)
            .ThenByDescending(refund => refund.CreatedAt)
            .ThenByDescending(refund => refund.Id)
            .Select(MapRefundSnapshot)
            .ToArray();
    }
}
