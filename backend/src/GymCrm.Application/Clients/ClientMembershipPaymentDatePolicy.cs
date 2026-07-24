namespace GymCrm.Application.Clients;

public static class ClientMembershipPaymentDatePolicy
{
    public static ClientMembershipPaymentDateValidationResult Validate(DateOnly? paymentDate, DateOnly businessDate)
    {
        if (!paymentDate.HasValue)
        {
            return ClientMembershipPaymentDateValidationResult.Missing;
        }

        return paymentDate.Value > businessDate
            ? ClientMembershipPaymentDateValidationResult.Future
            : ClientMembershipPaymentDateValidationResult.Valid;
    }
}

public enum ClientMembershipPaymentDateValidationResult
{
    Valid = 0,
    Missing = 1,
    Future = 2
}
