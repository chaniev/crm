using GymCrm.Api.SeedData;
using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class LeninskySeedDataTests
{
    [Fact]
    public void Seed_definition_contains_requested_branch_administrators_and_memberships()
    {
        Assert.Equal("Ленинский", LeninskySeedData.BranchName);
        Assert.Equal("1", LeninskySeedData.DefaultPassword);
        Assert.Equal(5, LeninskySeedData.AdministratorCount);

        Assert.Equal(
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
            ],
            LeninskySeedData.Memberships);
    }
}
