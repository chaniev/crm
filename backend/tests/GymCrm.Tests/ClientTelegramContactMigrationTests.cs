using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class ClientTelegramContactMigrationTests
{
    [Fact]
    public async Task Retained_upgrade_adds_empty_contact_and_preserves_relationships()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var groupId = await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261116010000_UseInclusiveTrainerPeriods");
        var clientId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Clients" ("Id", "BranchId", "FirstName", "Phone", "Status", "CreatedAt", "UpdatedAt")
            VALUES ({clientId}, {factory.OwnBranchId}, 'Existing', '111', 'Active', {now}, {now})
            """);
        var actorId = await db.Users.Where(user => user.Role == UserRole.Administrator).Select(user => user.Id).SingleAsync();
        var contact = new ClientContact { Id = Guid.NewGuid(), ClientId = clientId, Type = "family", FullName = "Relative", Phone = "222" };
        var assignment = new ClientGroupAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            GroupId = groupId,
            CreatedByUserId = actorId,
            ValidFrom = DateOnly.FromDateTime(now.UtcDateTime),
            CreatedAt = now
        };
        db.ClientContacts.Add(contact);
        db.ClientGroups.Add(new ClientGroup { ClientId = clientId, GroupId = groupId, BranchId = factory.OwnBranchId });
        db.ClientGroupAssignments.Add(assignment);
        db.ClientMessengerAccounts.Add(new ClientMessengerAccount
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Platform = MessengerPlatform.Telegram,
            Username = "bot_account",
            PlatformUserId = "123",
            PlatformUserIdHash = new string('a', 64),
            CreatedAt = now,
            LinkedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await migrator.MigrateAsync();
        var client = await db.Clients
            .Include(c => c.Contacts).Include(c => c.Groups).Include(c => c.GroupAssignments).Include(c => c.MessengerAccounts)
            .AsSplitQuery().SingleAsync(c => c.Id == clientId);
        Assert.Null(client.TelegramContactUsername);
        Assert.Equal("111", client.Phone);
        Assert.Equal(contact.Id, Assert.Single(client.Contacts).Id);
        Assert.Equal(groupId, Assert.Single(client.Groups).GroupId);
        Assert.Equal(assignment.Id, Assert.Single(client.GroupAssignments).Id);
        Assert.Equal("bot_account", Assert.Single(client.MessengerAccounts).Username);
    }
}
