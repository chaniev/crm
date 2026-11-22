using System.Net;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class StaffPasswordResetPostgreSqlTests
{
    private const string PreviousMigration = "20261122090204_AddGroupTrainerSubstitutionPeriods";

    [Fact]
    public async Task Upgrade_preserves_credentials_flags_and_legacy_cookie_until_first_reset()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var oldUsers = await db.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync();
        Assert.Contains(oldUsers, u => u.MustChangePassword);
        Assert.Contains(oldUsers, u => !u.MustChangePassword);
        var coach = oldUsers.Single(u => u.Role == UserRole.Coach);
        var (recipient, _) = await factory.LoginAsync(UserRole.Coach);
        using var recipientClient = recipient;
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(PreviousMigration);
        await migrator.MigrateAsync();
        var users = await db.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync();
        Assert.Equal(oldUsers.Select(u => (u.Id, u.PasswordHash, u.MustChangePassword, u.UpdatedAt)),
            users.Select(u => (u.Id, u.PasswordHash, u.MustChangePassword, u.UpdatedAt)));
        Assert.All(users, u => { Assert.Null(u.CredentialVersion); Assert.False(u.PasswordResetPending); });
        using var valid = await recipient.GetAsync("/auth/profile");
        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);

        var (manager, csrf) = await factory.LoginAsync(UserRole.HeadCoach);
        using var managerClient = manager;
        using var reset = await ResetAsync(manager, csrf, coach.Id);
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        // Reproduce a timestamp collision so the UUID claim alone distinguishes this session.
        await db.Users.Where(u => u.Id == coach.Id).ExecuteUpdateAsync(set => set.SetProperty(u => u.UpdatedAt, coach.UpdatedAt));
        using var revoked = await recipient.GetAsync("/auth/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, revoked.StatusCode);
        Assert.DoesNotContain(revoked.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies : [],
            header => header.StartsWith("gym-crm.auth=", StringComparison.Ordinal));
        var failure = await Assert.ThrowsAsync<PostgresException>(() => migrator.MigrateAsync(PreviousMigration));
        Assert.Contains("password-reset-downgrade-blocked", failure.MessageText);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Reset_and_personal_change_observe_credential_state_in_commit_order(bool resetFirst)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var (manager, managerCsrf) = await factory.LoginAsync(UserRole.HeadCoach);
        var (recipient, recipientCsrf) = await factory.LoginAsync(UserRole.Coach);
        using var managerClient = manager;
        using var recipientClient = recipient;
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var id = await db.Users.Where(u => u.Role == UserRole.Coach).Select(u => u.Id).SingleAsync();
        await using var barrier = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "Users" WHERE "Id" = {id} FOR UPDATE""");
        Task<HttpResponseMessage> ChangeAsync() => BranchSettingsAppFactory.SendAsync(recipient, HttpMethod.Post,
            "/auth/change-password", new { currentPassword = BranchSettingsAppFactory.Password, newPassword = "Personal-test173" }, recipientCsrf);
        var first = resetFirst ? ResetAsync(manager, managerCsrf, id) : ChangeAsync();
        await WaitForLockQueueAsync(postgres.GetConnectionString(), 1);
        var second = resetFirst ? ChangeAsync() : ResetAsync(manager, managerCsrf, id);
        await WaitForLockQueueAsync(postgres.GetConnectionString(), 2);
        await barrier.CommitAsync();
        using var firstResult = await first;
        using var secondResult = await second;
        Assert.Equal(resetFirst ? HttpStatusCode.NoContent : HttpStatusCode.OK, firstResult.StatusCode);
        Assert.Equal(resetFirst ? HttpStatusCode.Unauthorized : HttpStatusCode.NoContent, secondResult.StatusCode);
        var coach = await db.Users.SingleAsync(u => u.Id == id);
        Assert.True(coach.PasswordResetPending);
        Assert.True(coach.MustChangePassword);
        Assert.True(scope.ServiceProvider.GetRequiredService<GymCrm.Application.Security.IPasswordHashService>()
            .VerifyPassword(coach, "temporary-test"));
        Assert.Equal(1, await db.AuditLogs.CountAsync(x => x.ActionType == "PasswordReset"));
        Assert.Equal(resetFirst ? 0 : 1, await db.AuditLogs.CountAsync(x => x.ActionType == "PasswordChanged"));
    }

    [Theory]
    [InlineData("branch", true)]
    [InlineData("branch", false)]
    [InlineData("role", true)]
    [InlineData("role", false)]
    [InlineData("assignment", true)]
    [InlineData("assignment", false)]
    public async Task Reset_is_serialized_with_removal_of_its_authorization(string permissionChange, bool resetFirst)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var groupId = await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var actor = await db.Users.SingleAsync(u => u.Role == UserRole.Administrator);
        var coach = await db.Users.AsNoTracking().SingleAsync(u => u.Role == UserRole.Coach);
        db.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            GroupId = groupId,
            TrainerId = coach.Id,
            CreatedByUserId = actor.Id,
            ValidFrom = new DateOnly(2020, 1, 1),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var (client, csrf) = await factory.LoginAsync(UserRole.Administrator);
        using var manager = client;
        await using var barrier = await db.Database.BeginTransactionAsync();
        if (permissionChange == "assignment")
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR UPDATE""");
        }
        else
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "Users" WHERE "Id" = {actor.Id} FOR UPDATE""");
        }

        async Task RemovePermissionAsync()
        {
            using var writerScope = factory.Services.CreateScope();
            var writer = writerScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            await using var transaction = await writer.Database.BeginTransactionAsync();
            switch (permissionChange)
            {
                case "branch":
                    await writer.Users.Where(u => u.Id == actor.Id).ExecuteUpdateAsync(set =>
                        set.SetProperty(u => u.BranchId, factory.ForeignBranchId));
                    break;
                case "role":
                    await writer.Users.Where(u => u.Id == actor.Id).ExecuteUpdateAsync(set =>
                        set.SetProperty(u => u.Role, UserRole.Coach).SetProperty(u => u.BranchId, (Guid?)null));
                    break;
                case "assignment":
                    await writer.TrainingGroups.Where(g => g.Id == groupId).ExecuteUpdateAsync(set =>
                        set.SetProperty(g => g.UpdatedAt, DateTimeOffset.UtcNow));
                    await writer.GroupTrainerAssignments.Where(a => a.GroupId == groupId).ExecuteDeleteAsync();
                    break;
            }
            await transaction.CommitAsync();
        }

        Task<HttpResponseMessage> reset;
        Task removal;
        if (resetFirst)
        {
            reset = ResetAsync(manager, csrf, coach.Id);
            await WaitForLockQueueAsync(postgres.GetConnectionString(), 1);
            removal = RemovePermissionAsync();
        }
        else
        {
            removal = RemovePermissionAsync();
            await WaitForLockQueueAsync(postgres.GetConnectionString(), 1);
            reset = ResetAsync(manager, csrf, coach.Id);
        }
        await WaitForLockQueueAsync(postgres.GetConnectionString(), 2);
        await barrier.CommitAsync();
        await removal;
        using var response = await reset;
        Assert.Equal(resetFirst ? HttpStatusCode.NoContent : HttpStatusCode.Forbidden, response.StatusCode);
        var stored = await db.Users.AsNoTracking().SingleAsync(u => u.Id == coach.Id);
        Assert.Equal(resetFirst, stored.PasswordResetPending);
        Assert.Equal(resetFirst, stored.CredentialVersion.HasValue);
        Assert.Equal(!resetFirst, stored.PasswordHash == coach.PasswordHash);
        Assert.Equal(resetFirst ? 1 : 0, await db.AuditLogs.CountAsync(x => x.ActionType == "PasswordReset"));
    }

    private static Task<HttpResponseMessage> ResetAsync(HttpClient manager, string csrf, Guid id) =>
        BranchSettingsAppFactory.SendAsync(manager, HttpMethod.Post, $"/coaches/{id}/reset-password",
            new { temporaryPassword = "temporary-test" }, csrf);

    private static async Task WaitForLockQueueAsync(string connectionString, int count)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        await using var observer = new NpgsqlConnection(connectionString);
        await observer.OpenAsync(timeout.Token);
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'", observer);
        while ((long)(await command.ExecuteScalarAsync(timeout.Token))! < count)
        {
            await Task.Delay(25, timeout.Token);
        }
    }
}
