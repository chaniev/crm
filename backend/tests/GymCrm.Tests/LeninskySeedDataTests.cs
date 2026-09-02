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
        Assert.Equal("headcoach", LeninskySeedData.HeadCoachLogin);
        Assert.Equal("sa", LeninskySeedData.SuperAdministratorLogin);

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
    public async Task Administrators_only_seed_creates_branch_and_management_users_without_operational_data()
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
        Assert.Equal("headcoach", summary.HeadCoachLogin);
        Assert.Equal("sa", summary.SuperAdministratorLogin);
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

        var headCoach = await dbContext.Users.SingleAsync(
            user => user.Login == LeninskySeedData.HeadCoachLogin);
        Assert.Equal(UserRole.HeadCoach, headCoach.Role);
        Assert.Equal(LeninskySeedData.HeadCoachFullName, headCoach.FullName);
        Assert.Null(headCoach.BranchId);
        Assert.True(headCoach.IsActive);
        Assert.False(headCoach.MustChangePassword);
        Assert.Equal(
            PasswordVerificationResult.Success,
            passwordHasher.VerifyHashedPassword(
                headCoach,
                headCoach.PasswordHash,
                LeninskySeedData.DefaultPassword));

        var superAdministrator = await dbContext.Users.SingleAsync(
            user => user.Login == LeninskySeedData.SuperAdministratorLogin);
        Assert.Equal(UserRole.SuperAdministrator, superAdministrator.Role);
        Assert.Equal(LeninskySeedData.SuperAdministratorFullName, superAdministrator.FullName);
        Assert.Null(superAdministrator.BranchId);
        Assert.True(superAdministrator.IsActive);
        Assert.False(superAdministrator.MustChangePassword);
        Assert.Equal(
            PasswordVerificationResult.Success,
            passwordHasher.VerifyHashedPassword(
                superAdministrator,
                superAdministrator.PasswordHash,
                LeninskySeedData.DefaultPassword));

        Assert.Equal(7, await dbContext.Users.CountAsync());
        Assert.Empty(await dbContext.MembershipCatalogItems.ToArrayAsync());
        Assert.Empty(await dbContext.Clients.ToArrayAsync());
        Assert.Empty(await dbContext.TrainingGroups.ToArrayAsync());
        Assert.Empty(await dbContext.GroupTypes.ToArrayAsync());
    }

    [Fact]
    public async Task Administrators_only_seed_renames_legacy_administrator_logins()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"leninsky-admins-only-legacy-logins-{Guid.NewGuid():N}")
            .Options;
        await using var dbContext = new GymCrmDbContext(options);
        var now = DateTimeOffset.UtcNow;

        for (var number = 1; number <= LeninskySeedData.AdministratorCount; number++)
        {
            dbContext.Users.Add(new User
            {
                Id = LeninskySeedIds.Administrator(number),
                FullName = $"Legacy administrator {number}",
                Login = $"leninsky.admin{number}",
                PasswordHash = "legacy-password-hash",
                Role = UserRole.Administrator,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await dbContext.SaveChangesAsync();

        await using var seeder = new LeninskyAdministratorsOnlySeeder(dbContext);
        await seeder.SeedAsync(CancellationToken.None);

        var logins = await dbContext.Users
            .OrderBy(user => user.Login)
            .Select(user => user.Login)
            .ToArrayAsync();

        Assert.Equal(
            [
                "admin1",
                "admin2",
                "admin3",
                "admin4",
                "admin5",
                "headcoach",
                "sa"
            ],
            logins);
        Assert.DoesNotContain(logins, login => login.StartsWith("leninsky.", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Administrators_only_seed_adopts_case_variant_login_without_duplicates()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"leninsky-admins-only-case-variant-{Guid.NewGuid():N}")
            .Options;
        await using var dbContext = new GymCrmDbContext(options);
        var now = DateTimeOffset.UtcNow;

        dbContext.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            FullName = "Legacy administrator case variant",
            Login = "ADMIN1",
            PasswordHash = "legacy-password-hash",
            Role = UserRole.Administrator,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync();

        await using var seeder = new LeninskyAdministratorsOnlySeeder(dbContext);
        await seeder.SeedAsync(CancellationToken.None);
        await seeder.SeedAsync(CancellationToken.None);

        var users = await dbContext.Users.ToArrayAsync();
        var administratorLogins = users
            .Where(user => user.Role == UserRole.Administrator)
            .OrderBy(user => user.Login)
            .Select(user => user.Login)
            .ToArray();

        Assert.Equal(["admin1", "admin2", "admin3", "admin4", "admin5"], administratorLogins);
        Assert.Equal(7, users.Length);
        Assert.DoesNotContain(users, user => user.Login == "ADMIN1");
        Assert.All(users, user =>
            Assert.Equal(LoginIdentity.NormalizeKey(user.Login), user.LoginNormalized));
        Assert.Equal(
            users.Length,
            users.Select(user => user.LoginNormalized).Distinct(StringComparer.Ordinal).Count());
    }
}
