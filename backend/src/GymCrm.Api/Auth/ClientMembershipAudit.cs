using System.Text.Json;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;

namespace GymCrm.Api.Auth;

internal static partial class ClientEndpoints
{
    private static string? SerializeMembershipAuditState(ClientMembership? membership)
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
                membership.CreatedAt),
            AuditSerializerOptions);
    }

    private static string SerializeSaleAuditState(ClientMembershipSaleSnapshotResult sale)
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

    private static string SerializeRefundAuditState(ClientMembershipRefundSnapshotResult refund)
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
}
