namespace GymCrm.Domain.Clients;

public static class ClientMembershipSaleDisplay
{
    public static readonly string AmountOnlyLabel = global::GymCrm.Domain.UserFacingText.ClientMembershipDisplayText.ClientMembershipSaleDisplayLine592f64d0d;

    public static string GetMembershipName(ClientMembershipSale sale) =>
        sale.MembershipCatalogItem?.Name ?? AmountOnlyLabel;

    public static decimal? GetCatalogPrice(ClientMembershipSale sale) =>
        sale.MembershipCatalogItem?.Price;
}
