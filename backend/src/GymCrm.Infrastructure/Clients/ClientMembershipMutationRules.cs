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
        DateTimeOffset now,
        IReadOnlyList<ClientMembershipTargetDescriptor>? targets = null)
    {
        var membership = new ClientMembership
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

        if (targets is not null)
        {
            AddTargets(membership, targets);
        }

        return membership;
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

    public static void AddTargets(ClientMembership membership, IReadOnlyList<ClientMembershipTargetDescriptor> targets)
    {
        membership.TargetGroups.Clear();
        for (var index = 0; index < targets.Count; index++)
        {
            membership.TargetGroups.Add(new ClientMembershipTargetGroup
            {
                ClientMembershipId = membership.Id,
                GroupId = targets[index].GroupId,
                BranchId = targets[index].BranchId,
                Position = index
            });
        }
    }

    public static IReadOnlyList<ClientMembershipSaleTargetSnapshot> CreateSaleTargetSnapshots(
        Guid saleId,
        IReadOnlyList<ClientMembershipTargetDescriptor> targets,
        string provenance = "Write")
    {
        return targets
            .Select((target, index) => new ClientMembershipSaleTargetSnapshot
            {
                SaleId = saleId,
                GroupId = target.GroupId,
                BranchId = target.BranchId,
                Position = index,
                Provenance = provenance
            })
            .ToArray();
    }

    public static IReadOnlyList<ClientMembershipRefundTargetSnapshot> CreateRefundTargetSnapshots(
        Guid refundId,
        IReadOnlyList<ClientMembershipTargetGroup> targets,
        string provenance = "Write")
    {
        return targets
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipRefundTargetSnapshot
            {
                RefundId = refundId,
                GroupId = target.GroupId,
                BranchId = target.BranchId,
                Position = target.Position,
                Provenance = provenance
            })
            .ToArray();
    }
}
