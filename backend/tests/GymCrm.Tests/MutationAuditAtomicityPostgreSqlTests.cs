using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Messenger;
using GymCrm.Application.Security;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class MutationAuditAtomicityPostgreSqlTests
{
    [Theory]
    [InlineData("PUT", "/branches/{branchId}", "BranchUpdated", false)]
    [InlineData("PUT", "/halls/{hallId}", "HallUpdated", false)]
    [InlineData("PUT", "/halls/{hallId}/archive", "HallArchived", false)]
    [InlineData("PUT", "/halls/{hallId}/restore", "HallRestored", true)]
    [InlineData("DELETE", "/halls/{hallId}", "HallDeleted", false)]
    [InlineData("POST", "/group-types", "GroupTypeCreated", false)]
    [InlineData("PUT", "/group-types/{groupTypeId}", "GroupTypeUpdated", false)]
    [InlineData("DELETE", "/group-types/{groupTypeId}", "GroupTypeDeleted", false)]
    public async Task Audit_insert_failure_preserves_settings_and_previously_recorded_audit(
        string method, string route, string action, bool initiallyArchivedHall)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var interceptor = new AuditFailureInterceptor(action);
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), interceptor);
        await factory.SeedAsync();
        var groupTypeId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var hall = await db.Halls.SingleAsync(item => item.Id == factory.OwnHallId);
            hall.IsArchived = initiallyArchivedHall;
            var timestamp = new DateTimeOffset(2026, 10, 24, 8, 0, 0, TimeSpan.Zero);
            db.GroupTypes.Add(new GroupType
            {
                Id = groupTypeId,
                Name = "Original group type",
                CreatedAt = timestamp,
                UpdatedAt = timestamp
            });
            await db.SaveChangesAsync();
        }

        var (client, token) = await factory.LoginAsync(UserRole.HeadCoach);
        using (client)
        {
            var before = await SnapshotAsync(factory);
            var path = route
                .Replace("{branchId}", factory.OwnBranchId.ToString(), StringComparison.Ordinal)
                .Replace("{hallId}", factory.OwnHallId.ToString(), StringComparison.Ordinal)
                .Replace("{groupTypeId}", groupTypeId.ToString(), StringComparison.Ordinal);
            object? body = action.EndsWith("Created", StringComparison.Ordinal) || action.EndsWith("Updated", StringComparison.Ordinal)
                ? new { name = "Changed settings", description = "Changed description", branchId = factory.OwnBranchId }
                : null;
            using var response = await BranchSettingsAppFactory.SendAsync(client, new HttpMethod(method), path, body, token);

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            Assert.True(interceptor.FailureInjected);
            Assert.Equal(before, await SnapshotAsync(factory));

            interceptor.Enabled = false;
            using var retried = await BranchSettingsAppFactory.SendAsync(client, new HttpMethod(method), path, body, token);
            var expectedStatus = method switch
            {
                "POST" => HttpStatusCode.Created,
                "DELETE" => HttpStatusCode.NoContent,
                _ => HttpStatusCode.OK
            };
            Assert.Equal(expectedStatus, retried.StatusCode);
            using var verificationScope = factory.Services.CreateScope();
            var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Single(await verificationDb.AuditLogs.Where(item => item.ActionType == action).ToArrayAsync());
            var changePersisted = action switch
            {
                "BranchUpdated" => await verificationDb.Branches.AnyAsync(item => item.Id == factory.OwnBranchId && item.Name == "Changed settings"),
                "HallUpdated" => await verificationDb.Halls.AnyAsync(item => item.Id == factory.OwnHallId && item.Name == "Changed settings"),
                "HallArchived" => await verificationDb.Halls.AnyAsync(item => item.Id == factory.OwnHallId && item.IsArchived),
                "HallRestored" => await verificationDb.Halls.AnyAsync(item => item.Id == factory.OwnHallId && !item.IsArchived),
                "HallDeleted" => !await verificationDb.Halls.AnyAsync(item => item.Id == factory.OwnHallId),
                "GroupTypeCreated" => await verificationDb.GroupTypes.AnyAsync(item => item.Id != groupTypeId && item.Name == "Changed settings"),
                "GroupTypeUpdated" => await verificationDb.GroupTypes.AnyAsync(item => item.Id == groupTypeId && item.Name == "Changed settings"),
                "GroupTypeDeleted" => !await verificationDb.GroupTypes.AnyAsync(item => item.Id == groupTypeId),
                _ => throw new InvalidOperationException($"Unexpected audit action: {action}")
            };
            Assert.True(changePersisted, $"The successful retry must persist {action}.");
        }
    }

    [Fact]
    public async Task Password_audit_failure_preserves_credentials_and_allows_retry()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var interceptor = new AuditFailureInterceptor("PasswordChanged");
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), interceptor);
        await factory.SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var user = await db.Users.SingleAsync(item => item.Login == nameof(UserRole.HeadCoach));
            user.MustChangePassword = true;
            await db.SaveChangesAsync();
        }

        var (client, token) = await factory.LoginAsync(UserRole.HeadCoach);
        using (client)
        {
            var before = await SnapshotAsync(factory);
            var body = new { currentPassword = BranchSettingsAppFactory.Password, newPassword = "changed-test-password" };
            using var failed = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/auth/change-password", body, token);

            Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
            Assert.True(interceptor.FailureInjected);
            Assert.Equal(before, await SnapshotAsync(factory));

            interceptor.Enabled = false;
            using var retried = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/auth/change-password", body, token);
            Assert.Equal(HttpStatusCode.OK, retried.StatusCode);
            using var verificationScope = factory.Services.CreateScope();
            var db = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwords = verificationScope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var user = await db.Users.SingleAsync(item => item.Login == nameof(UserRole.HeadCoach));
            Assert.False(user.MustChangePassword);
            Assert.True(passwords.VerifyPassword(user, body.newPassword));
            Assert.False(passwords.VerifyPassword(user, body.currentPassword));
            Assert.Single(await db.AuditLogs.Where(item => item.ActionType == "PasswordChanged").ToArrayAsync());
        }
    }

    [Fact]
    public async Task Telegram_link_audit_failure_preserves_token_and_allows_one_successful_retry()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var interceptor = new AuditFailureInterceptor(ClientMessengerAuditConstants.AccountLinkedAction);
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), interceptor);
        await factory.SeedAsync();
        const string rawToken = "audit-rollback-link-token";
        var clientId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(item => item.Login == nameof(UserRole.HeadCoach));
            var now = DateTimeOffset.UtcNow;
            db.Clients.Add(new Client
            {
                Id = clientId,
                BranchId = factory.OwnBranchId,
                FirstName = "Test client",
                Phone = "+79990001234",
                CreatedAt = now,
                UpdatedAt = now
            });
            db.ClientMessengerLinkTokens.Add(new ClientMessengerLinkToken
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                Platform = MessengerPlatform.Telegram,
                TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
                CreatedByUserId = actor.Id,
                CreatedAt = now,
                ExpiresAt = now.AddHours(1)
            });
            await db.SaveChangesAsync();
        }

        var before = await SnapshotAsync(factory);
        var update = new ClientTelegramIncomingUpdate(
            100, 10, "777001", "777001", "test_client", "Test", "Client", $"/start {rawToken}", DateTimeOffset.UtcNow);
        using (var scope = factory.Services.CreateScope())
        {
            var messenger = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
            await Assert.ThrowsAsync<DbUpdateException>(() => messenger.HandleTelegramUpdateAsync(update));
        }

        Assert.True(interceptor.FailureInjected);
        Assert.Equal(before, await SnapshotAsync(factory));

        interceptor.Enabled = false;
        using (var scope = factory.Services.CreateScope())
        {
            var messenger = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
            Assert.Equal(ClientTelegramUpdateHandleStatus.AccountLinked, (await messenger.HandleTelegramUpdateAsync(update)).Status);
            Assert.Equal(ClientTelegramUpdateHandleStatus.InvalidToken, (await messenger.HandleTelegramUpdateAsync(update)).Status);
        }

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Single(await verificationDb.ClientMessengerAccounts.Where(item => item.ClientId == clientId).ToArrayAsync());
        Assert.NotNull((await verificationDb.ClientMessengerLinkTokens.SingleAsync()).UsedAt);
        Assert.Single(await verificationDb.AuditLogs.Where(item => item.ActionType == ClientMessengerAuditConstants.AccountLinkedAction).ToArrayAsync());
    }

    private static async Task<string> SnapshotAsync(BranchSettingsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        return JsonSerializer.Serialize(new
        {
            branches = await db.Branches.AsNoTracking().OrderBy(item => item.Id)
                .Select(item => new { item.Id, item.Name, item.Address, item.Description, item.IsArchived, item.CreatedAt, item.UpdatedAt }).ToArrayAsync(),
            halls = await db.Halls.AsNoTracking().OrderBy(item => item.Id)
                .Select(item => new { item.Id, item.BranchId, item.Name, item.Description, item.IsArchived, item.CreatedAt, item.UpdatedAt }).ToArrayAsync(),
            groupTypes = await db.GroupTypes.AsNoTracking().OrderBy(item => item.Id)
                .Select(item => new { item.Id, item.Name, item.Description, item.CreatedAt, item.UpdatedAt }).ToArrayAsync(),
            users = await db.Users.AsNoTracking().OrderBy(item => item.Id)
                .Select(item => new { item.Id, item.PasswordHash, item.MustChangePassword, item.UpdatedAt }).ToArrayAsync(),
            accounts = await db.ClientMessengerAccounts.AsNoTracking().OrderBy(item => item.Id).ToArrayAsync(),
            tokens = await db.ClientMessengerLinkTokens.AsNoTracking().OrderBy(item => item.Id).ToArrayAsync(),
            audits = await db.AuditLogs.AsNoTracking().OrderBy(item => item.Id).ToArrayAsync()
        });
    }

    private sealed class AuditFailureInterceptor(string action) : SaveChangesInterceptor
    {
        public bool Enabled { get; set; } = true;
        public bool FailureInjected { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && eventData.Context!.ChangeTracker.Entries<AuditLog>()
                .Any(entry => entry.State == EntityState.Added && entry.Entity.ActionType == action))
            {
                FailureInjected = true;
                throw new DbUpdateException("Injected mandatory audit insert failure.");
            }

            return ValueTask.FromResult(result);
        }
    }
}
