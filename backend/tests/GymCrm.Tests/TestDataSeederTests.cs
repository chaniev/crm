using GymCrm.Api.SeedData;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Tests;

public sealed class TestDataSeederTests
{
    [Fact]
    public async Task Full_seed_is_repeatable_and_cleans_current_seed_related_state()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        connection.CreateFunction("btrim", (string value) => value.Trim(), isDeterministic: true);
        connection.CreateFunction(
            "cardinality",
            (string? value) => string.IsNullOrWhiteSpace(value) ? 0 : value.Count(character => character == ',') + 1,
            isDeterministic: true);
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var dbContext = new GymCrmDbContext(options);
        await dbContext.Database.EnsureCreatedAsync();

        var photoRoot = Path.Combine(Path.GetTempPath(), $"gym-crm-full-seed-tests-{Guid.NewGuid():N}");
        try
        {
            await using var seeder = new TestDataSeeder(dbContext, photoRoot);

            var firstSummary = await seeder.SeedAsync(CancellationToken.None);
            Assert.Equal(SeedIds.ClientCount, firstSummary.ClientCount);

            var seededAdministratorId = SeedIds.Administrator(1);
            var seededClientId = SeedIds.Client(1);
            var now = DateTimeOffset.UtcNow;
            var externalBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "External branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalUser = new User
            {
                Id = Guid.NewGuid(),
                FullName = "External Head Coach",
                Login = $"external-head-coach-{Guid.NewGuid():N}",
                Role = UserRole.HeadCoach,
                PasswordHash = "external-password-hash",
                MustChangePassword = false,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalClient = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = externalBranch.Id,
                LastName = "External",
                FirstName = "Client",
                Phone = "+79990000001",
                Notes = "External notes",
                NotesChangedByUserId = seededAdministratorId,
                NotesChangedAt = now,
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalSale = new ClientMembershipSale
            {
                Id = Guid.NewGuid(),
                ClientId = externalClient.Id,
                BehaviorKind = GymCrm.Domain.Memberships.MembershipBehaviorKind.Term,
                PricingMode = ClientMembershipSalePricingMode.AmountOnly,
                PurchaseDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                GrossAmount = 1000m,
                CreatedByUserId = externalUser.Id,
                CreatedAt = now,
                Comment = "External sale comment",
                CommentChangedByUserId = seededAdministratorId,
                CommentChangedAt = now
            };
            dbContext.Branches.Add(externalBranch);
            dbContext.Users.Add(externalUser);
            dbContext.Clients.Add(externalClient);
            dbContext.ClientMembershipSales.Add(externalSale);
            dbContext.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
            {
                Id = Guid.NewGuid(),
                ActorUserId = seededAdministratorId,
                IdempotencyKey = "stale-seed-idempotency",
                ActionType = "ClientMembershipPurchased",
                PayloadHash = "hash",
                Status = "Completed",
                ClientId = seededClientId,
                CreatedAt = now,
                UpdatedAt = now,
                ExpiresAt = now.AddDays(1)
            });
            await dbContext.SaveChangesAsync();

            var secondSummary = await seeder.SeedAsync(CancellationToken.None);

            Assert.Equal(firstSummary with { PhotoStorageRootPath = secondSummary.PhotoStorageRootPath }, secondSummary);
            Assert.False(await dbContext.ClientMembershipIdempotencyRecords
                .AnyAsync(record => record.ClientId == seededClientId || record.ActorUserId == seededAdministratorId));

            var externalClientAfterSeed = await dbContext.Clients.SingleAsync(client => client.Id == externalClient.Id);
            Assert.Null(externalClientAfterSeed.NotesChangedByUserId);
            Assert.Null(externalClientAfterSeed.NotesChangedAt);

            var externalSaleAfterSeed = await dbContext.ClientMembershipSales.SingleAsync(sale => sale.Id == externalSale.Id);
            Assert.Null(externalSaleAfterSeed.CommentChangedByUserId);
            Assert.Null(externalSaleAfterSeed.CommentChangedAt);

            var administrators = await dbContext.Users
                .Where(user => SeedIds.UserIds.Contains(user.Id) && user.Role == UserRole.Administrator)
                .ToArrayAsync();
            Assert.Equal(SeedIds.AdministratorCount, administrators.Length);
            Assert.All(administrators, administrator => Assert.NotNull(administrator.BranchId));

            var birthDates = await dbContext.Clients
                .Where(client => SeedIds.ClientIds.Contains(client.Id))
                .Select(client => client.BirthDate)
                .ToArrayAsync();
            Assert.Equal(SeedIds.ClientCount, birthDates.Length);
            Assert.All(birthDates, birthDate =>
            {
                Assert.NotNull(birthDate);
                Assert.InRange(birthDate.Value, new DateOnly(1978, 1, 1), new DateOnly(2007, 12, 31));
            });
        }
        finally
        {
            if (Directory.Exists(photoRoot))
            {
                Directory.Delete(photoRoot, recursive: true);
            }
        }
    }
}
