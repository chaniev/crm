using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public enum ClientMembershipSalePricingError
{
    None = 0,
    MissingCatalogAndAmount = 1,
    InvalidManualAmount = 2,
    InvalidCatalogPrice = 3,
    ProfessionalOverrideNotAllowed = 4
}

public sealed record ClientMembershipSalePricingResolution(
    ClientMembershipSalePricingMode PricingMode,
    decimal GrossAmount,
    MembershipBehaviorKind BehaviorKind,
    Guid? MembershipCatalogItemId);

public readonly record struct ClientMembershipSalePricingResult(
    ClientMembershipSalePricingError Error,
    ClientMembershipSalePricingResolution? Resolution)
{
    public bool Succeeded => Error == ClientMembershipSalePricingError.None && Resolution is not null;
}

public static class ClientMembershipSalePricingPolicy
{
    public const decimal MaximumAmount = RubMoneyPolicy.MaximumAmount;

    public static ClientMembershipSalePricingResult Resolve(
        MembershipCatalogItem? catalogItem,
        decimal? manualSaleAmount)
    {
        if (catalogItem is null)
        {
            if (!manualSaleAmount.HasValue)
            {
                return Failure(ClientMembershipSalePricingError.MissingCatalogAndAmount);
            }

            return IsWholeRubAmount(manualSaleAmount.Value, allowZero: false)
                ? Success(ClientMembershipSalePricingMode.AmountOnly, manualSaleAmount.Value,
                    MembershipBehaviorKind.Term, null)
                : Failure(ClientMembershipSalePricingError.InvalidManualAmount);
        }

        var catalogAllowsZero = catalogItem.BehaviorKind == MembershipBehaviorKind.Professional;
        if (!IsWholeRubAmount(catalogItem.Price, catalogAllowsZero) ||
            (catalogAllowsZero && catalogItem.Price != 0m))
        {
            return Failure(ClientMembershipSalePricingError.InvalidCatalogPrice);
        }

        if (!manualSaleAmount.HasValue)
        {
            return Success(ClientMembershipSalePricingMode.Catalog, catalogItem.Price,
                catalogItem.BehaviorKind, catalogItem.Id);
        }

        if (catalogItem.BehaviorKind == MembershipBehaviorKind.Professional)
        {
            return Failure(ClientMembershipSalePricingError.ProfessionalOverrideNotAllowed);
        }

        return IsWholeRubAmount(manualSaleAmount.Value, allowZero: false)
            ? Success(ClientMembershipSalePricingMode.CatalogOverride, manualSaleAmount.Value,
                catalogItem.BehaviorKind, catalogItem.Id)
            : Failure(ClientMembershipSalePricingError.InvalidManualAmount);
    }

    public static bool IsWholeRubAmount(decimal amount, bool allowZero) =>
        RubMoneyPolicy.IsWholeAmount(amount, allowZero);

    private static ClientMembershipSalePricingResult Success(
        ClientMembershipSalePricingMode pricingMode,
        decimal grossAmount,
        MembershipBehaviorKind behaviorKind,
        Guid? membershipCatalogItemId) =>
        new(ClientMembershipSalePricingError.None,
            new ClientMembershipSalePricingResolution(
                pricingMode,
                grossAmount,
                behaviorKind,
                membershipCatalogItemId));

    private static ClientMembershipSalePricingResult Failure(ClientMembershipSalePricingError error) =>
        new(error, null);
}
