using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Infrastructure.Clients;

internal static class ClientMembershipMutationRules
{
    public static bool IsValidSaleCommand(Guid clientId, Guid actorId, DateOnly paymentDate, DateOnly today) =>
        clientId != Guid.Empty &&
        actorId != Guid.Empty &&
        ClientMembershipPaymentDatePolicy.Validate(paymentDate, today) ==
        ClientMembershipPaymentDateValidationResult.Valid;

    public static ClientMembershipMutationError MapPricingError(ClientMembershipSalePricingError error) => error switch
    {
        ClientMembershipSalePricingError.MissingCatalogAndAmount => ClientMembershipMutationError.PricingSelectionMissing,
        ClientMembershipSalePricingError.InvalidManualAmount => ClientMembershipMutationError.ManualSaleAmountInvalid,
        ClientMembershipSalePricingError.ProfessionalOverrideNotAllowed => ClientMembershipMutationError.ProfessionalOverrideNotAllowed,
        ClientMembershipSalePricingError.InvalidCatalogPrice => ClientMembershipMutationError.InvalidRequest,
        _ => ClientMembershipMutationError.InvalidRequest
    };

    public static ClientMembershipMutationError ValidateCatalogItem(
        MembershipCatalogItem? item,
        Guid branchId,
        DateOnly today)
    {
        if (item is null)
        {
            return ClientMembershipMutationError.CatalogItemMissing;
        }

        if (item.BranchId.HasValue && item.BranchId != branchId)
        {
            return ClientMembershipMutationError.CatalogItemBranchMismatch;
        }

        return item.IsAvailableOn(today)
            ? ClientMembershipMutationError.None
            : ClientMembershipMutationError.CatalogItemUnavailable;
    }

    public static bool ValidateValidity(
        MembershipBehaviorKind kind,
        DateOnly? validFrom,
        DateOnly? validTo,
        string? comment) =>
        kind switch
        {
            MembershipBehaviorKind.SingleVisit => validFrom is null && validTo is null && string.IsNullOrWhiteSpace(comment),
            MembershipBehaviorKind.Term => validFrom.HasValue && validTo >= validFrom && string.IsNullOrWhiteSpace(comment),
            MembershipBehaviorKind.Professional => validFrom.HasValue && (validTo is null || validTo >= validFrom) && !string.IsNullOrWhiteSpace(comment),
            _ => false
        };

    public static ClientMembershipMutationError MapAddressedMembershipStatus(AddressedMembershipStatus status) => status switch
    {
        AddressedMembershipStatus.Missing => ClientMembershipMutationError.MembershipTargetMissing,
        AddressedMembershipStatus.Conflict => ClientMembershipMutationError.MembershipTargetConflict,
        _ => ClientMembershipMutationError.InvalidRequest
    };

    public static ClientMembership CreateMembership(
        Guid clientId,
        ClientMembershipSale sale,
        DateOnly? validFrom,
        DateOnly? validTo,
        bool singleVisitUsed,
        string? professionalComment,
        ClientMembershipChangeReason reason,
        Guid actorId,
        DateTimeOffset now)
    {
        return new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = sale.Id,
            BehaviorKind = sale.BehaviorKind,
            IndividualValidFrom = validFrom,
            IndividualValidTo = validTo,
            ProfessionalComment = string.IsNullOrWhiteSpace(professionalComment) ? null : professionalComment.Trim(),
            SingleVisitUsed = singleVisitUsed,
            ChangeReason = reason,
            ChangedByUserId = actorId,
            ValidFrom = now,
            CreatedAt = now
        };
    }

    public static ClientMembershipSale CreateSale(
        Guid clientId,
        MembershipCatalogItem? item,
        ClientMembershipSalePricingResolution pricing,
        DateOnly purchaseDate,
        DateOnly paymentDate,
        Guid actorId,
        DateTimeOffset now)
    {
        return new ClientMembershipSale
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            MembershipCatalogItemId = pricing.MembershipCatalogItemId,
            MembershipCatalogItem = item,
            BehaviorKind = pricing.BehaviorKind,
            PricingMode = pricing.PricingMode,
            PurchaseDate = purchaseDate,
            PaymentDate = paymentDate,
            GrossAmount = pricing.GrossAmount,
            CreatedByUserId = actorId,
            CreatedAt = now
        };
    }
}
