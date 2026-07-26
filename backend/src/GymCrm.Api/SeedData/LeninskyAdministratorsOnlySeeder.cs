using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal sealed class LeninskyAdministratorsOnlySeeder : IAsyncDisposable
{
    private readonly GymCrmDbContext dbContext;
    private readonly bool applyMigrations;
    private readonly bool ownsDbContext;
    private readonly PasswordHasher<User> passwordHasher = new();

    public LeninskyAdministratorsOnlySeeder(SeedDataOptions options)
        : this(CreateDbContext(options.ConnectionString), options.ApplyMigrations, ownsDbContext: true)
    {
    }

    internal LeninskyAdministratorsOnlySeeder(GymCrmDbContext dbContext)
        : this(dbContext, applyMigrations: false, ownsDbContext: false)
    {
    }

    private LeninskyAdministratorsOnlySeeder(
        GymCrmDbContext dbContext,
        bool applyMigrations,
        bool ownsDbContext)
    {
        this.dbContext = dbContext;
        this.applyMigrations = applyMigrations;
        this.ownsDbContext = ownsDbContext;
    }

    public async Task<LeninskyAdministratorsOnlySeedSummary> SeedAsync(CancellationToken cancellationToken)
    {
        if (applyMigrations)
        {
            await dbContext.Database.MigrateAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var branch = await LeninskyBranchSeed.ResolveAsync(dbContext, now, cancellationToken);
        var administratorCount = await LeninskyAdministratorSeed.UpsertAsync(
            dbContext,
            passwordHasher,
            branch.Id,
            now,
            cancellationToken);
        await LeninskyPrivilegedUserSeed.UpsertAsync(
            dbContext,
            passwordHasher,
            now,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new LeninskyAdministratorsOnlySeedSummary(
            branch.Name,
            administratorCount,
            LeninskySeedData.HeadCoachLogin,
            LeninskySeedData.SuperAdministratorLogin,
            LeninskySeedData.DefaultPassword);
    }

    public ValueTask DisposeAsync() =>
        ownsDbContext ? dbContext.DisposeAsync() : ValueTask.CompletedTask;

    private static GymCrmDbContext CreateDbContext(string connectionString)
    {
        var optionsBuilder = new DbContextOptionsBuilder<GymCrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new GymCrmDbContext(optionsBuilder.Options);
    }
}
