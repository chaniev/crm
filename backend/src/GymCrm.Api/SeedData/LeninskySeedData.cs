using GymCrm.Domain.Memberships;

namespace GymCrm.Api.SeedData;

internal static class LeninskySeedData
{
    public const string BranchName = "Ленинский";
    public const string DefaultPassword = "1";
    public const int AdministratorCount = 5;
    public const string HeadCoachLogin = "headcoach";
    public const string HeadCoachFullName = "Главный тренер";
    public const string SuperAdministratorLogin = "sa";
    public const string SuperAdministratorFullName = "Суперадминистратор";

    public static readonly (string Name, decimal Price, MembershipBehaviorKind BehaviorKind)[] Memberships =
    [
        ("Пробная тренировка", 500m, MembershipBehaviorKind.SingleVisit),
        ("Разовая", 1000m, MembershipBehaviorKind.SingleVisit),
        ("На месяц", 6000m, MembershipBehaviorKind.Term),
        ("Второй час", 1500m, MembershipBehaviorKind.SingleVisit),
        ("Второй + третий", 2500m, MembershipBehaviorKind.SingleVisit),
        ("Пробная функциональные", 850m, MembershipBehaviorKind.SingleVisit),
        ("Разовая функциональные", 1500m, MembershipBehaviorKind.SingleVisit),
        ("Месяц функциональные 8 тренировок", 6500m, MembershipBehaviorKind.Term),
        ("12 тренировок", 8000m, MembershipBehaviorKind.Term)
    ];
}
