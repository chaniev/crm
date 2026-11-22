using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class TrainerPeriodMigrationTests
{
    private const string Previous = "20260901120001_RequireCaseInsensitiveLoginIdentity";

    [Fact]
    public async Task Clean_bootstrap_allows_one_day_and_guarded_downgrade_preserves_it()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var group = await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var trainer = await db.Users.SingleAsync(u => u.Role == UserRole.Coach);
        var day = new DateOnly(2035, 1, 1);
        db.GroupTrainerAssignments.Add(Period(group, trainer.Id, day, day));
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAnyAsync<Exception>(() => db.GetService<IMigrator>().MigrateAsync(Previous));
        Assert.Contains("trainer-period-downgrade-blocked", error.ToString(), StringComparison.Ordinal);
        db.ChangeTracker.Clear();
        var stored = Assert.Single(await db.GroupTrainerAssignments.ToArrayAsync());
        Assert.Equal(day, stored.ValidFrom);
        Assert.Equal(day, stored.ValidTo);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Retained_upgrade_preserves_dates_and_refuses_conflicting_boundaries(bool conflict)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var group = await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(Previous);
        var trainerId = await db.Users.Where(u => u.Role == UserRole.Coach).Select(u => u.Id).SingleAsync();
        var start = new DateOnly(2035, 1, 1);
        var first = Period(group, trainerId, start, start.AddDays(1));
        var second = Period(group, trainerId, start.AddDays(conflict ? 1 : 3), null);
        db.GroupTrainerAssignments.AddRange(first, second);
        await db.SaveChangesAsync();
        if (conflict)
        {
            var error = await Assert.ThrowsAnyAsync<Exception>(() => migrator.MigrateAsync());
            Assert.Contains("trainer-period-overlap", error.ToString(), StringComparison.Ordinal);
            Assert.Contains(first.Id.ToString(), error.ToString(), StringComparison.Ordinal);
            Assert.DoesNotContain("20261116010000_UseInclusiveTrainerPeriods", await db.Database.GetAppliedMigrationsAsync());
        }
        else
        {
            await migrator.MigrateAsync();
            db.GroupTrainerAssignments.Add(Period(group, trainerId, start.AddDays(1), start.AddDays(2)));
            var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.Contains("EX_GroupTrainerAssignments_TrainerGroup_Period_NoOverlap", error.ToString(), StringComparison.Ordinal);
        }
        db.ChangeTracker.Clear();
        var rows = await db.GroupTrainerAssignments.OrderBy(a => a.ValidFrom).ToArrayAsync();
        Assert.Equal(2, rows.Length);
        Assert.Equal(first.ValidFrom, rows[0].ValidFrom);
        Assert.Equal(first.ValidTo, rows[0].ValidTo);
        Assert.Equal(second.ValidFrom, rows[1].ValidFrom);
        Assert.Null(rows[1].ValidTo);
    }

    private static GroupTrainerAssignment Period(Guid group, Guid trainer, DateOnly from, DateOnly? to) => new()
    {
        Id = Guid.NewGuid(),
        GroupId = group,
        TrainerId = trainer,
        ValidFrom = from,
        ValidTo = to,
        CreatedByUserId = trainer,
        CreatedAt = DateTimeOffset.UtcNow
    };
}
