namespace GymCrm.Domain.Clients;

public static class ClientMembershipSaleDisplay
{
    public const string AmountOnlyLabel = "Без варианта каталога";

    public static string GetMembershipName(ClientMembershipSale sale) =>
        sale.MembershipCatalogItem?.Name ?? AmountOnlyLabel;

    public static decimal? GetCatalogPrice(ClientMembershipSale sale) =>
        sale.MembershipCatalogItem?.Price;
}
