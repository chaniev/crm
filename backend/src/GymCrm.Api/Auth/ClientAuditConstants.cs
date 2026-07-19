namespace GymCrm.Api.Auth;

internal static class ClientAuditConstants
{
    public const string ClientCreatedAction = "ClientCreated";
    public const string ClientUpdatedAction = "ClientUpdated";
    public const string ClientArchivedAction = "ClientArchived";
    public const string ClientRestoredAction = "ClientRestored";
    public const string ClientTransferredAction = "ClientTransferred";
    public const string MembershipPurchasedAction = "ClientMembershipPurchased";
    public const string MembershipRenewedAction = "ClientMembershipRenewed";
    public const string MembershipCorrectedAction = "ClientMembershipCorrected";
    public const string MembershipPaymentMarkedAction = "ClientMembershipPaymentMarked";
    public const string MembershipSaleCorrectedAction = "ClientMembershipSaleCorrected";
    public const string MembershipRefundCreatedAction = "ClientMembershipRefundCreated";
    public const string MembershipRefundCanceledAction = "ClientMembershipRefundCanceled";

    public const string ClientEntityType = "Client";
    public const string MembershipEntityType = "ClientMembership";
    public const string MembershipSaleEntityType = "ClientMembershipSale";
    public const string MembershipRefundEntityType = "ClientMembershipRefund";
}
