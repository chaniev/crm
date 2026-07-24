namespace GymCrm.Domain.Clients;

public enum ClientMembershipChangeReason
{
    NewPurchase = 1,
    Renewal = 2,
    Correction = 3,
    SingleVisitWriteOff = 5,
    SingleVisitRestore = 6
}
