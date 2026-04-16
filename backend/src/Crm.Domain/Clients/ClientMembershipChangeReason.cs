namespace Crm.Domain.Clients;

public enum ClientMembershipChangeReason
{
    NewPurchase = 1,
    Renewal = 2,
    Correction = 3,
    PaymentUpdate = 4,
    SingleVisitWriteOff = 5
}
