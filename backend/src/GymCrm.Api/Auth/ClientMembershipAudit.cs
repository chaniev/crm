using System.Text.Json;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;

namespace GymCrm.Api.Auth;

internal static class ClientMembershipAudit
{
    internal static string? SerializeMembershipAuditState(ClientMembership? membership)
    {
        if (membership is null)
        {
            return null;
        }

        return JsonSerializer.Serialize(
            new ClientMembershipAuditState(
                membership.Id,
                membership.ClientId,
                membership.SaleId,
                membership.Sale.MembershipCatalogItemId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind.ToString(),
                membership.Sale.PricingMode.ToString(),
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
                membership.ChangeReason.ToString(),
                membership.ChangedByUserId,
                membership.ValidFrom,
                membership.ValidTo,
                membership.CreatedAt,
                MapTargetAuditState(membership)),
            AuditSerializerOptions);
    }

    internal static string SerializeMembershipCollectionAuditState(IEnumerable<ClientMembership> memberships)
    {
        return JsonSerializer.Serialize(
            memberships
                .Where(membership => membership.ValidTo is null)
                .OrderBy(membership => membership.SaleId)
                .ThenBy(membership => membership.Id)
                .Select(membership => new ClientMembershipAuditState(
                    membership.Id,
                    membership.ClientId,
                    membership.SaleId,
                    membership.Sale.MembershipCatalogItemId,
                    ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                    membership.BehaviorKind.ToString(),
                    membership.Sale.PricingMode.ToString(),
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
                    membership.ChangeReason.ToString(),
                    membership.ChangedByUserId,
                    membership.ValidFrom,
                    membership.ValidTo,
                    membership.CreatedAt,
                    MapTargetAuditState(membership)))
                .ToArray(),
            AuditSerializerOptions);
    }

    internal static string SerializeSaleAuditState(ClientMembershipSaleSnapshotResult sale)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipSaleAuditState(
                sale.Id,
                sale.ClientId,
                sale.MembershipCatalogItemId,
                sale.MembershipName,
                sale.BehaviorKind.ToString(),
                sale.PricingMode.ToString(),
                sale.PurchaseDate,
                sale.PaymentDate,
                sale.GrossAmount,
                sale.CatalogPrice,
                sale.CreatedByUserId,
                sale.CreatedAt),
            AuditSerializerOptions);
    }

    internal static string SerializeRefundAuditState(ClientMembershipRefundSnapshotResult refund)
    {
        return JsonSerializer.Serialize(
            new ClientMembershipRefundAuditState(
                refund.Id,
                refund.SaleId,
                refund.ClientId,
                refund.Amount,
                refund.RefundDate,
                refund.Comment,
                refund.CreatedByUserId,
                refund.CreatedAt,
                refund.CanceledAt,
                refund.CanceledByUserId),
            AuditSerializerOptions);
    }

    private static IReadOnlyList<ClientMembershipTargetAuditState> MapTargetAuditState(ClientMembership membership)
    {
        return membership.TargetGroups
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipTargetAuditState(
                target.GroupId,
                target.Group.Name,
                target.BranchId,
                target.Group.Branch.Name,
                target.Position,
                target.Group.IsActive))
            .ToArray();
    }
}
