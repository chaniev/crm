using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal sealed class LeninskyTestDataSeeder(SeedDataOptions options) : IAsyncDisposable
{
    private readonly GymCrmDbContext dbContext = CreateDbContext(options.ConnectionString);
    private readonly PasswordHasher<User> passwordHasher = new();

    public async Task<LeninskyTestDataSummary> SeedAsync(CancellationToken cancellationToken)
    {
        if (options.ApplyMigrations)
        {
            await dbContext.Database.MigrateAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var availableFrom = DateOnly.FromDateTime(now.UtcDateTime);
        var branch = await LeninskyBranchSeed.ResolveAsync(dbContext, now, cancellationToken);

        var administratorCount = await LeninskyAdministratorSeed.UpsertAsync(
            dbContext,
            passwordHasher,
            branch.Id,
            now,
            cancellationToken);
        var membershipCount = await UpsertMembershipsAsync(branch.Id, availableFrom, now, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new LeninskyTestDataSummary(
            branch.Name,
            administratorCount,
            membershipCount,
            LeninskySeedData.DefaultPassword);
    }

    public ValueTask DisposeAsync() => dbContext.DisposeAsync();

    private async Task<int> UpsertMembershipsAsync(
        Guid branchId,
        DateOnly availableFrom,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var normalizedNames = LeninskySeedData.Memberships
            .Select(membership => MembershipCatalogItem.NormalizeName(membership.Name))
            .ToArray();
        var existingItems = await dbContext.MembershipCatalogItems
            .Where(item => item.BranchId == branchId && normalizedNames.Contains(item.NormalizedName))
            .ToDictionaryAsync(item => item.NormalizedName, StringComparer.Ordinal, cancellationToken);

        for (var index = 0; index < LeninskySeedData.Memberships.Length; index++)
        {
            var membership = LeninskySeedData.Memberships[index];
            var normalizedName = MembershipCatalogItem.NormalizeName(membership.Name);

            if (existingItems.TryGetValue(normalizedName, out var existingItem))
            {
                existingItem.Name = membership.Name;
                existingItem.Price = membership.Price;
                existingItem.BehaviorKind = membership.BehaviorKind;
                existingItem.AvailableTo = null;
                existingItem.IsSystemOwned = false;
                existingItem.UpdatedAt = now;
                continue;
            }

            var item = MembershipCatalogItem.CreateBranchOwned(
                branchId,
                membership.Name,
                membership.Price,
                membership.BehaviorKind,
                availableFrom,
                null,
                now);
            item.Id = LeninskySeedIds.Membership(index + 1);
            dbContext.MembershipCatalogItems.Add(item);
        }

        return LeninskySeedData.Memberships.Length;
    }

    private static GymCrmDbContext CreateDbContext(string connectionString)
    {
        var optionsBuilder = new DbContextOptionsBuilder<GymCrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new GymCrmDbContext(optionsBuilder.Options);
    }
}
