using GymCrm.Api.SeedData;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

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

    [Fact]
    public async Task Administrators_only_seed_creates_branch_and_admins_without_catalog_or_operational_data()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"leninsky-admins-only-seed-{Guid.NewGuid():N}")
            .Options;
        await using var dbContext = new GymCrmDbContext(options);
        var passwordHasher = new PasswordHasher<User>();

        await using var seeder = new LeninskyAdministratorsOnlySeeder(dbContext);

        var summary = await seeder.SeedAsync(CancellationToken.None);
        var secondSummary = await seeder.SeedAsync(CancellationToken.None);

        Assert.Equal("Ленинский", summary.BranchName);
        Assert.Equal(5, summary.AdministratorCount);
        Assert.Equal("1", summary.DefaultUserPassword);
        Assert.Equal(summary, secondSummary);

        var branch = await dbContext.Branches.SingleAsync();
        Assert.Equal(LeninskySeedData.BranchName, branch.Name);
        Assert.False(branch.IsArchived);

        var administrators = await dbContext.Users
            .Where(user => user.Role == UserRole.Administrator)
            .OrderBy(user => user.Login)
            .ToArrayAsync();
        Assert.Equal(5, administrators.Length);
        Assert.Equal(
            Enumerable.Range(1, 5).Select(LeninskyAdministratorSeed.CreateLogin),
            administrators.Select(user => user.Login));
        Assert.All(administrators, administrator =>
        {
            Assert.Equal(branch.Id, administrator.BranchId);
            Assert.True(administrator.IsActive);
            Assert.False(administrator.MustChangePassword);
            Assert.Equal(
                PasswordVerificationResult.Success,
                passwordHasher.VerifyHashedPassword(
                    administrator,
                    administrator.PasswordHash,
                    LeninskySeedData.DefaultPassword));
        });

        Assert.Equal(5, await dbContext.Users.CountAsync());
        Assert.Empty(await dbContext.MembershipCatalogItems.ToArrayAsync());
        Assert.Empty(await dbContext.Clients.ToArrayAsync());
        Assert.Empty(await dbContext.TrainingGroups.ToArrayAsync());
        Assert.Empty(await dbContext.GroupTypes.ToArrayAsync());
    }
}
