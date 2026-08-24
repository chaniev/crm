using GymCrm.Api.SeedData;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using AttendanceEntry = GymCrm.Domain.Attendance.Attendance;

namespace GymCrm.Tests;

public sealed class TestDataSeederTests
{
    private static readonly TimeZoneInfo BusinessTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    [Fact]
    public async Task Full_seed_is_repeatable_and_cleans_current_seed_related_state()
    {
        await using var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase($"gym_crm_seed_{Guid.NewGuid():N}")
            .WithUsername("gym_crm")
            .WithPassword("gym_crm")
            .Build();
        await postgreSql.StartAsync();
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(postgreSql.GetConnectionString())
            .Options;
        await using var dbContext = new GymCrmDbContext(options);
        await dbContext.Database.MigrateAsync();

        var photoRoot = Path.Combine(Path.GetTempPath(), $"gym-crm-full-seed-tests-{Guid.NewGuid():N}");
        try
        {
            await using var seeder = new TestDataSeeder(dbContext, photoRoot);

            var deploymentDateLowerBound = CurrentBusinessDate();
            var firstSummary = await seeder.SeedAsync(CancellationToken.None);
            var deploymentDateUpperBound = CurrentBusinessDate();
            Assert.Equal(SeedIds.ClientCount, firstSummary.ClientCount);
            await AssertRequestedOperationalSeedAsync(
                dbContext,
                deploymentDateLowerBound,
                deploymentDateUpperBound);

            var seededAdministratorId = SeedIds.Administrator(1);
            var seededClientId = SeedIds.Client(1);
            var seededBranchId = SeedIds.Branch(1);
            var seededGroupId = SeedIds.TrainingGroup(1);
            var now = DateTimeOffset.UtcNow;
            var externalBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "External branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = externalBranch.Id,
                Name = "External hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalGroupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = $"External type {Guid.NewGuid():N}",
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = externalBranch.Id,
                HallId = externalHall.Id,
                GroupTypeId = externalGroupType.Id,
                Name = "External group",
                TrainingStartTime = new TimeOnly(10, 0),
                DurationMinutes = 90,
                Weekdays = [1, 3, 5],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalSuperAdministrator = new User
            {
                Id = Guid.NewGuid(),
                FullName = "External Super Administrator",
                Login = $"external-super-administrator-{Guid.NewGuid():N}",
                Role = UserRole.SuperAdministrator,
                PasswordHash = "external-password-hash",
                MustChangePassword = false,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalAdministrator = new User
            {
                Id = Guid.NewGuid(),
                FullName = "External Administrator",
                Login = $"external-administrator-{Guid.NewGuid():N}",
                Role = UserRole.Administrator,
                BranchId = externalBranch.Id,
                PasswordHash = "external-password-hash",
                MustChangePassword = false,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var externalCoach = new User
            {
                Id = Guid.NewGuid(),
                FullName = "External Coach",
                Login = $"external-coach-{Guid.NewGuid():N}",
                Role = UserRole.Coach,
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
            var externalClientWithSeedGroupAttendance = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = externalBranch.Id,
                LastName = "External",
                FirstName = "Seed group attendance",
                Phone = "+79990000002",
                Status = ClientStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            };
            var seededGroup = await dbContext.TrainingGroups
                .AsNoTracking()
                .SingleAsync(group => group.Id == seededGroupId);
            var externalAttendanceOccurrenceId = Guid.NewGuid();
            var externalAttendance = new AttendanceEntry
            {
                Id = Guid.NewGuid(),
                ClientId = seededClientId,
                GroupId = externalGroup.Id,
                LessonOccurrenceId = externalAttendanceOccurrenceId,
                TrainingDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                IsPresent = false,
                MarkedByUserId = seededAdministratorId,
                MarkedAt = now,
                UpdatedAt = now
            };
            var preservedExternalAttendanceOccurrenceId = Guid.NewGuid();
            var preservedExternalAttendance = new AttendanceEntry
            {
                Id = Guid.NewGuid(),
                ClientId = externalClient.Id,
                GroupId = externalGroup.Id,
                LessonOccurrenceId = preservedExternalAttendanceOccurrenceId,
                TrainingDate = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-1)),
                IsPresent = false,
                MarkedByUserId = externalSuperAdministrator.Id,
                MarkedAt = now,
                UpdatedAt = now
            };
            var seedGroupAttendanceId = Guid.NewGuid();
            var seedGroupAttendanceOccurrenceId = Guid.NewGuid();
            var seedGroupAcknowledgementId = Guid.NewGuid();
            var preservedAcknowledgementId = Guid.NewGuid();
            var preservedSubstitutionId = Guid.NewGuid();
            var seedClientSaleId = Guid.NewGuid();
            var externalSale = new ClientMembershipSale
            {
                Id = Guid.NewGuid(),
                ClientId = externalClient.Id,
                BehaviorKind = GymCrm.Domain.Memberships.MembershipBehaviorKind.Term,
                PricingMode = ClientMembershipSalePricingMode.AmountOnly,
                PurchaseDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                PaymentDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                GrossAmount = 1000m,
                CreatedByUserId = externalSuperAdministrator.Id,
                CreatedAt = now,
                Comment = "External sale comment",
                CommentChangedByUserId = seededAdministratorId,
                CommentChangedAt = now
            };
            var seedClientSale = new ClientMembershipSale
            {
                Id = seedClientSaleId,
                ClientId = seededClientId,
                BehaviorKind = GymCrm.Domain.Memberships.MembershipBehaviorKind.Term,
                PricingMode = ClientMembershipSalePricingMode.AmountOnly,
                PurchaseDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                PaymentDate = DateOnly.FromDateTime(now.UtcDateTime.Date),
                GrossAmount = 1100m,
                CreatedByUserId = externalSuperAdministrator.Id,
                CreatedAt = now
            };
            dbContext.Branches.Add(externalBranch);
            dbContext.Halls.Add(externalHall);
            dbContext.GroupTypes.Add(externalGroupType);
            dbContext.TrainingGroups.Add(externalGroup);
            dbContext.Users.AddRange(externalSuperAdministrator, externalAdministrator, externalCoach);
            dbContext.Clients.AddRange(externalClient, externalClientWithSeedGroupAttendance);
            await dbContext.SaveChangesAsync();
            await InsertLegacyAttendanceOccurrenceAsync(
                dbContext,
                externalAttendanceOccurrenceId,
                externalGroup.Id,
                externalAttendance.TrainingDate,
                externalGroup.TrainingStartTime,
                externalGroup.DurationMinutes,
                externalHall.Id,
                now);
            await InsertLegacyAttendanceOccurrenceAsync(
                dbContext,
                preservedExternalAttendanceOccurrenceId,
                externalGroup.Id,
                preservedExternalAttendance.TrainingDate,
                externalGroup.TrainingStartTime,
                externalGroup.DurationMinutes,
                externalHall.Id,
                now);
            await InsertLegacyAttendanceOccurrenceAsync(
                dbContext,
                seedGroupAttendanceOccurrenceId,
                seededGroup.Id,
                DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-2)),
                seededGroup.TrainingStartTime,
                seededGroup.DurationMinutes,
                seededGroup.HallId,
                now);
            dbContext.Attendance.AddRange(
                externalAttendance,
                preservedExternalAttendance,
                new AttendanceEntry
                {
                    Id = seedGroupAttendanceId,
                    ClientId = externalClientWithSeedGroupAttendance.Id,
                    GroupId = seededGroupId,
                    LessonOccurrenceId = seedGroupAttendanceOccurrenceId,
                    TrainingDate = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-2)),
                    IsPresent = false,
                    MarkedByUserId = externalSuperAdministrator.Id,
                    MarkedAt = now,
                    UpdatedAt = now
                });
            dbContext.ClientMissedTrainingAcknowledgements.Add(new ClientMissedTrainingAcknowledgement
            {
                Id = Guid.NewGuid(),
                ClientId = seededClientId,
                LastAttendanceId = externalAttendance.Id,
                LastTrainingDate = externalAttendance.TrainingDate,
                LastTrainingStartTime = externalGroup.TrainingStartTime,
                AcknowledgedAt = now,
                AcknowledgedByUserId = externalSuperAdministrator.Id
            });
            dbContext.ClientMissedTrainingAcknowledgements.Add(new ClientMissedTrainingAcknowledgement
            {
                Id = seedGroupAcknowledgementId,
                ClientId = externalClientWithSeedGroupAttendance.Id,
                LastAttendanceId = seedGroupAttendanceId,
                LastTrainingDate = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-2)),
                LastTrainingStartTime = externalGroup.TrainingStartTime,
                AcknowledgedAt = now,
                AcknowledgedByUserId = externalSuperAdministrator.Id
            });
            dbContext.ClientMissedTrainingAcknowledgements.Add(new ClientMissedTrainingAcknowledgement
            {
                Id = preservedAcknowledgementId,
                ClientId = externalClient.Id,
                LastAttendanceId = preservedExternalAttendance.Id,
                LastTrainingDate = preservedExternalAttendance.TrainingDate,
                LastTrainingStartTime = externalGroup.TrainingStartTime,
                AcknowledgedAt = now,
                AcknowledgedByUserId = externalSuperAdministrator.Id
            });
            dbContext.AdministratorAttendanceGroupGrants.AddRange(
                new AdministratorAttendanceGroupGrant
                {
                    AdministratorId = seededAdministratorId,
                    GroupId = externalGroup.Id,
                    BranchId = externalBranch.Id,
                    GrantedByUserId = seededAdministratorId,
                    GrantedAt = now
                },
                new AdministratorAttendanceGroupGrant
                {
                    AdministratorId = externalAdministrator.Id,
                    GroupId = seededGroupId,
                    BranchId = seededBranchId,
                    GrantedByUserId = externalSuperAdministrator.Id,
                    GrantedAt = now
                },
                new AdministratorAttendanceGroupGrant
                {
                    AdministratorId = externalAdministrator.Id,
                    GroupId = externalGroup.Id,
                    BranchId = externalBranch.Id,
                    GrantedByUserId = externalSuperAdministrator.Id,
                    GrantedAt = now
                });
            dbContext.GroupTrainerSubstitutions.AddRange(
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = externalGroup.Id,
                    SubstituteTrainerId = seededAdministratorId,
                    StartsOn = DateOnly.FromDateTime(now.UtcDateTime.Date),
                    EndsOn = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(7)),
                    CreatedByUserId = seededAdministratorId,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seededGroupId,
                    SubstituteTrainerId = externalCoach.Id,
                    StartsOn = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(14)),
                    EndsOn = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(21)),
                    CreatedByUserId = externalSuperAdministrator.Id,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new GroupTrainerSubstitution
                {
                    Id = preservedSubstitutionId,
                    GroupId = externalGroup.Id,
                    SubstituteTrainerId = externalCoach.Id,
                    StartsOn = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(30)),
                    EndsOn = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(37)),
                    CreatedByUserId = externalSuperAdministrator.Id,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            dbContext.ClientMembershipSales.AddRange(externalSale, seedClientSale);
            dbContext.ClientMembershipIdempotencyRecords.Add(new ClientMembershipIdempotencyRecord
            {
                Id = Guid.NewGuid(),
                ActorUserId = externalSuperAdministrator.Id,
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
            await AssertRequestedOperationalSeedAsync(
                dbContext,
                deploymentDateLowerBound,
                CurrentBusinessDate());
            Assert.False(await dbContext.ClientMembershipIdempotencyRecords
                .AnyAsync(record => record.ClientId == seededClientId || record.ActorUserId == seededAdministratorId));
            Assert.False(await dbContext.ClientMembershipSales.AnyAsync(sale => sale.Id == seedClientSaleId));
            Assert.False(await dbContext.Attendance.AnyAsync(attendance => attendance.Id == externalAttendance.Id));
            Assert.False(await dbContext.Attendance.AnyAsync(attendance => attendance.Id == seedGroupAttendanceId));
            Assert.False(await dbContext.ClientMissedTrainingAcknowledgements
                .AnyAsync(acknowledgement =>
                    acknowledgement.ClientId == seededClientId ||
                    acknowledgement.AcknowledgedByUserId == seededAdministratorId ||
                    acknowledgement.LastAttendanceId == externalAttendance.Id));
            Assert.False(await dbContext.ClientMissedTrainingAcknowledgements
                .AnyAsync(acknowledgement => acknowledgement.Id == seedGroupAcknowledgementId));
            Assert.False(await dbContext.AdministratorAttendanceGroupGrants
                .AnyAsync(grant =>
                    grant.AdministratorId == seededAdministratorId ||
                    grant.GroupId == seededGroupId ||
                    grant.BranchId == seededBranchId ||
                    grant.GrantedByUserId == seededAdministratorId));
            Assert.False(await dbContext.GroupTrainerSubstitutions
                .AnyAsync(substitution =>
                    substitution.GroupId == seededGroupId ||
                    substitution.SubstituteTrainerId == seededAdministratorId ||
                    substitution.CreatedByUserId == seededAdministratorId));
            Assert.True(await dbContext.Attendance
                .AnyAsync(attendance => attendance.Id == preservedExternalAttendance.Id));
            Assert.True(await dbContext.ClientMissedTrainingAcknowledgements
                .AnyAsync(acknowledgement => acknowledgement.Id == preservedAcknowledgementId));
            Assert.True(await dbContext.AdministratorAttendanceGroupGrants
                .AnyAsync(grant =>
                    grant.AdministratorId == externalAdministrator.Id &&
                    grant.GroupId == externalGroup.Id));
            Assert.True(await dbContext.GroupTrainerSubstitutions
                .AnyAsync(substitution => substitution.Id == preservedSubstitutionId));
            Assert.True(await dbContext.TrainingGroups.AnyAsync(group => group.Id == externalGroup.Id));

            var superAdministrator = await dbContext.Users.SingleAsync(user => user.Role == UserRole.SuperAdministrator);
            Assert.Equal(externalSuperAdministrator.Id, superAdministrator.Id);
            Assert.Null(superAdministrator.BranchId);

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

    private static DateOnly CurrentBusinessDate() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, BusinessTimeZone).DateTime);

    private static async Task AssertRequestedOperationalSeedAsync(
        GymCrmDbContext dbContext,
        DateOnly deploymentDateLowerBound,
        DateOnly deploymentDateUpperBound)
    {
        var seededClientIds = SeedIds.ClientIds;
        var memberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Where(membership => seededClientIds.Contains(membership.ClientId) && membership.ValidTo == null)
            .ToArrayAsync();

        Assert.Equal(255, memberships.Length);
        Assert.Equal(
            150,
            memberships.Count(membership =>
                membership.BehaviorKind == MembershipBehaviorKind.Term &&
                membership.IndividualValidFrom.HasValue &&
                membership.IndividualValidTo == membership.IndividualValidFrom.Value.AddYears(1).AddDays(-1)));
        Assert.Equal(
            90,
            memberships.Count(membership =>
                membership.BehaviorKind == MembershipBehaviorKind.Term &&
                membership.IndividualValidFrom.HasValue &&
                membership.IndividualValidTo == membership.IndividualValidFrom.Value.AddMonths(1).AddDays(-1)));
        Assert.Equal(15, memberships.Count(membership => membership.BehaviorKind == MembershipBehaviorKind.Professional));
        Assert.Equal(45, SeedIds.ClientCount - memberships.Select(membership => membership.ClientId).Distinct().Count());

        var professionalClientIds = memberships
            .Where(membership => membership.BehaviorKind == MembershipBehaviorKind.Professional)
            .Select(membership => membership.ClientId)
            .ToHashSet();
        var seededClientGroupCounts = await dbContext.ClientGroups
            .AsNoTracking()
            .Where(link => seededClientIds.Contains(link.ClientId))
            .GroupBy(link => link.ClientId)
            .Select(group => new { ClientId = group.Key, Count = group.Count() })
            .ToArrayAsync();

        Assert.Equal(SeedIds.ClientCount, seededClientGroupCounts.Length);
        Assert.Equal(29, seededClientGroupCounts.Count(client => client.Count == 2));
        Assert.Equal(SeedIds.ClientCount - 29, seededClientGroupCounts.Count(client => client.Count == 1));
        Assert.DoesNotContain(
            seededClientGroupCounts,
            client => client.Count == 2 && professionalClientIds.Contains(client.ClientId));

        var mismatchedBranchLinkCount = await (
            from link in dbContext.ClientGroups.AsNoTracking()
            join client in dbContext.Clients.AsNoTracking() on link.ClientId equals client.Id
            where seededClientIds.Contains(link.ClientId) && link.BranchId != client.BranchId
            select link).CountAsync();
        Assert.Equal(0, mismatchedBranchLinkCount);

        Assert.Equal(255, await dbContext.ClientMembershipSales.CountAsync(sale => seededClientIds.Contains(sale.ClientId)));
        Assert.Equal(8, await dbContext.MembershipCatalogItems.CountAsync(item => SeedIds.BranchIds.Contains(item.BranchId!.Value)));

        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .Where(item => SeedIds.TrainingGroupIds.Contains(item.GroupId))
            .Include(item => item.RuleVersions)
            .ThenInclude(version => version.Slots)
            .ToArrayAsync();

        Assert.Equal(SeedIds.TrainingGroupCount, series.Length);
        Assert.All(series, item =>
        {
            Assert.InRange(item.StartsOn, deploymentDateLowerBound, deploymentDateUpperBound);
            Assert.Null(item.EndsOn);
            var version = Assert.Single(item.RuleVersions);
            Assert.Equal(item.StartsOn, version.EffectiveFrom);
            Assert.Null(version.EffectiveTo);
        });

        var sundaySeries = Assert.Single(series, item => item.GroupId == SeedIds.TrainingGroup(1));
        var sundaySlot = Assert.Single(Assert.Single(sundaySeries.RuleVersions).Slots);
        Assert.Equal(7, sundaySlot.IsoWeekday);
        Assert.Equal(new TimeOnly(10, 30), sundaySlot.StartTime);

        foreach (var regularSeries in series.Where(item => item.GroupId != SeedIds.TrainingGroup(1)))
        {
            var slots = Assert.Single(regularSeries.RuleVersions).Slots.OrderBy(slot => slot.IsoWeekday).ToArray();
            Assert.Equal(3, slots.Length);
            var weekdays = slots.Select(slot => slot.IsoWeekday).ToArray();
            Assert.True(
                weekdays.SequenceEqual([1, 3, 5]) || weekdays.SequenceEqual([2, 4, 6]),
                $"Unexpected seeded schedule: {string.Join(',', weekdays)}.");
        }

        Assert.Equal(88, series.SelectMany(item => item.RuleVersions).SelectMany(version => version.Slots).Count());
        Assert.All(
            series.SelectMany(item => item.RuleVersions).SelectMany(version => version.Slots),
            slot => Assert.Contains(slot.HallId, SeedIds.HallIds));
        Assert.Equal(SeedIds.HallCount, await dbContext.Halls.CountAsync(hall => SeedIds.HallIds.Contains(hall.Id)));
    }

    private static async Task InsertLegacyAttendanceOccurrenceAsync(
        GymCrmDbContext dbContext,
        Guid id,
        Guid groupId,
        DateOnly lessonDate,
        TimeOnly startTime,
        int durationMinutes,
        Guid hallId,
        DateTimeOffset now)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "LessonOccurrences"
                ("Id", "GroupId", "LessonDate", "StartTime", "DurationMinutes", "HallId", "ProjectedDate", "Status", "SourceKind", "CreatedAt", "UpdatedAt")
            VALUES
                ({id}, {groupId}, {lessonDate}, {startTime}, {durationMinutes}, {hallId}, {lessonDate}, {"Scheduled"}, {"LegacyAttendance"}, {now}, {now})
            """);
    }
}
