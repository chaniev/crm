namespace GymCrm.Domain.Clients;

public static class RubMoneyPolicy
{
    public const decimal MaximumAmount = 99_999_999m;

    public static bool IsWholeAmount(decimal amount, bool allowZero) =>
        amount <= MaximumAmount &&
        amount == decimal.Truncate(amount) &&
        (allowZero ? amount >= 0m : amount > 0m);
}
