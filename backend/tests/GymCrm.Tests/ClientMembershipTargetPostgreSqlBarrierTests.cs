using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class ClientMembershipTargetPostgreSqlBarrierTests
{
    private static readonly DateOnly BusinessDate = new(2026, 8, 21);
    private static readonly DateTimeOffset FixedUtcNow = new(2026, 8, 21, 9, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task PostgreSql_purchase_accepts_ordered_one_to_five_targets_and_persists_ordered_snapshots()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();

        for (var count = 1; count <= 5; count++)
        {
            var clientId = await context.SeedClientAsync($"ordered-{count}");
            var targetGroupIds = context.Seeded.GroupIds.Take(count).ToArray();

            using var response = await context.PurchaseTermAsync(clientId, targetGroupIds, $"ordered-{count}");
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK, body);

            using var responseDocument = JsonDocument.Parse(body);
            AssertCurrentMembershipTargetOrder(responseDocument.RootElement, targetGroupIds);

            var persisted = await context.LoadCurrentMembershipTargetsAsync(clientId);
            Assert.Equal(targetGroupIds, persisted.TargetGroupIds);
            Assert.Equal(Enumerable.Range(0, count).ToArray(), persisted.Positions);

            var saleSnapshot = await context.LoadSaleTargetSnapshotsAsync(persisted.SaleId);
            Assert.Equal(targetGroupIds, saleSnapshot.GroupIds);
            Assert.Equal(Enumerable.Range(0, count).ToArray(), saleSnapshot.Positions);
            Assert.All(saleSnapshot.Provenance, provenance => Assert.Equal("Write", provenance));
        }
    }

    [Fact]
    public async Task PostgreSql_sixth_target_and_position_five_are_rejected_without_partial_persistence()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var clientId = await context.SeedClientAsync("sixth-target");

        using (var response = await context.PurchaseTermAsync(
                   clientId,
                   context.Seeded.GroupIds.Take(6).ToArray(),
                   "sixth-target"))
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, body);
            AssertProblemContainsField(body, "targetGroupIds");
        }

        await context.AssertNoMembershipWritesAsync(clientId);

        var invalidClientId = await context.SeedClientAsync("position-five");
        var saleId = Guid.NewGuid();
        var membershipId = Guid.NewGuid();
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() =>
            context.InsertMembershipWithInvalidPositionAsync(invalidClientId, saleId, membershipId));
        var postgresException = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.CheckViolation, postgresException.SqlState);
        Assert.Equal("CK_ClientMembershipTargetGroups_Position", postgresException.ConstraintName);
        await context.AssertNoMembershipWritesAsync(invalidClientId);
    }

    [Fact]
    public async Task PostgreSql_overlap_matrix_allows_disjoint_sets_and_rejects_intersection_professional_and_same_day()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var groupA = context.Seeded.GroupIds[0];
        var groupB = context.Seeded.GroupIds[1];
        var groupC = context.Seeded.GroupIds[2];

        var intersectionClientId = await context.SeedClientAsync("intersection");
        await context.SeedCurrentMembershipAsync(
            intersectionClientId,
            MembershipBehaviorKind.Term,
            [groupA, groupB],
            BusinessDate.AddDays(-10),
            BusinessDate);
        using (var response = await context.PurchaseTermAsync(
                   intersectionClientId,
                   [groupB, groupC],
                   "same-day-intersection",
                   validFrom: BusinessDate))
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.Conflict, body);
            AssertProblemType(body, "membership-overlap");
        }

        var disjointClientId = await context.SeedClientAsync("disjoint");
        await context.SeedCurrentMembershipAsync(
            disjointClientId,
            MembershipBehaviorKind.Term,
            [groupA, groupB],
            BusinessDate.AddDays(-10),
            BusinessDate.AddDays(10));
        using (var response = await context.PurchaseTermAsync(
                   disjointClientId,
                   [groupC],
                   "same-day-disjoint",
                   validFrom: BusinessDate))
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        }

        var existingProfessionalClientId = await context.SeedClientAsync("existing-professional");
        await context.SeedCurrentMembershipAsync(
            existingProfessionalClientId,
            MembershipBehaviorKind.Professional,
            [groupA],
            BusinessDate.AddDays(-10),
            null,
            professionalComment: "Professional membership for overlap barrier.");
        using (var response = await context.PurchaseTermAsync(
                   existingProfessionalClientId,
                   [groupC],
                   "existing-professional"))
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.Conflict, body);
            AssertProblemType(body, "membership-overlap");
        }

        var requestedProfessionalClientId = await context.SeedClientAsync("requested-professional");
        await context.SeedCurrentMembershipAsync(
            requestedProfessionalClientId,
            MembershipBehaviorKind.Term,
            [groupA],
            BusinessDate.AddDays(-10),
            BusinessDate.AddDays(10));
        using (var response = await context.PurchaseProfessionalAsync(
                   requestedProfessionalClientId,
                   [groupC],
                   "requested-professional"))
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.Conflict, body);
            AssertProblemType(body, "membership-overlap");
        }
    }

    [Fact]
    public async Task PostgreSql_concurrent_overlapping_purchases_return_success_and_stable_conflict_without_provider_leak()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var clientId = await context.SeedClientAsync("concurrent-overlap");
        var targetGroupIds = context.Seeded.GroupIds.Take(2).ToArray();

        var first = context.PurchaseTermAsync(clientId, targetGroupIds, "concurrent-first");
        var second = context.PurchaseTermAsync(clientId, targetGroupIds, "concurrent-second");

        using var firstResponse = await first;
        using var secondResponse = await second;
        var firstBody = await firstResponse.Content.ReadAsStringAsync();
        var secondBody = await secondResponse.Content.ReadAsStringAsync();

        Assert.Equal(1, new[] { firstResponse, secondResponse }.Count(response => response.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, new[] { firstResponse, secondResponse }.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        AssertProblemType(
            firstResponse.StatusCode == HttpStatusCode.Conflict ? firstBody : secondBody,
            "membership-overlap");
        AssertNoProviderLeak(firstBody);
        AssertNoProviderLeak(secondBody);
        Assert.Equal(1, await context.CountCurrentMembershipsAsync(clientId));
    }

    [Fact]
    public async Task PostgreSql_target_transfer_preserves_sale_and_event_snapshot_and_replaces_same_position()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var sourceGroupIds = context.Seeded.GroupIds.Take(2).ToArray();
        var targetGroupId = context.Seeded.GroupIds[2];
        var clientId = await context.SeedClientAsync("target-transfer");

        using (var purchase = await context.PurchaseTermAsync(clientId, sourceGroupIds, "target-transfer-purchase"))
        {
            var body = await purchase.Content.ReadAsStringAsync();
            Assert.True(purchase.StatusCode == HttpStatusCode.OK, body);
        }

        var before = await context.LoadCurrentMembershipTargetsAsync(clientId);
        using (var preview = await context.TransferTargetsAsync(
                   clientId,
                   sourceGroupIds[0],
                   targetGroupId,
                   expectedMembershipIds: null,
                   "target-transfer-preview"))
        {
            var body = await preview.Content.ReadAsStringAsync();
            Assert.True(preview.StatusCode == HttpStatusCode.OK, body);
            using var document = JsonDocument.Parse(body);
            var affected = GetRequiredProperty(document.RootElement, "affectedMemberships");
            Assert.Equal(before.MembershipId, GetRequiredProperty(Assert.Single(affected.EnumerateArray()), "membershipId").GetGuid());
        }

        using (var transfer = await context.TransferTargetsAsync(
                   clientId,
                   sourceGroupIds[0],
                   targetGroupId,
                   [before.MembershipId],
                   "target-transfer-submit"))
        {
            var body = await transfer.Content.ReadAsStringAsync();
            Assert.True(transfer.StatusCode == HttpStatusCode.OK, body);
        }

        var after = await context.LoadCurrentMembershipTargetsAsync(clientId);
        Assert.Equal(before.MembershipId, after.MembershipId);
        Assert.Equal(before.SaleId, after.SaleId);
        Assert.Equal([targetGroupId, sourceGroupIds[1]], after.TargetGroupIds);
        Assert.Equal([0, 1], after.Positions);
        Assert.Equal(1, await context.CountSalesAsync(clientId));

        var saleSnapshot = await context.LoadSaleTargetSnapshotsAsync(before.SaleId);
        Assert.Equal(sourceGroupIds, saleSnapshot.GroupIds);
        Assert.Equal([0, 1], saleSnapshot.Positions);
    }

    [Fact]
    public async Task PostgreSql_concurrent_refunds_respect_ceiling_and_successful_retry_is_idempotent()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var targetGroupIds = context.Seeded.GroupIds.Take(2).ToArray();
        var clientId = await context.SeedClientAsync("refund-concurrency");
        using (var purchase = await context.PurchaseTermAsync(clientId, targetGroupIds, "refund-purchase"))
        {
            var body = await purchase.Content.ReadAsStringAsync();
            Assert.True(purchase.StatusCode == HttpStatusCode.OK, body);
        }

        var membership = await context.LoadCurrentMembershipTargetsAsync(clientId);
        const string firstKey = "task115-refund-concurrent-first";
        const string secondKey = "task115-refund-concurrent-second";
        var first = context.RegisterRefundAsync(clientId, membership.SaleId, 1000m, firstKey);
        var second = context.RegisterRefundAsync(clientId, membership.SaleId, 1000m, secondKey);
        using var firstResponse = await first;
        using var secondResponse = await second;
        var firstBody = await firstResponse.Content.ReadAsStringAsync();
        var secondBody = await secondResponse.Content.ReadAsStringAsync();

        Assert.Equal(1, new[] { firstResponse, secondResponse }.Count(response => response.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, new[] { firstResponse, secondResponse }.Count(response => response.StatusCode == HttpStatusCode.BadRequest));
        AssertNoProviderLeak(firstBody);
        AssertNoProviderLeak(secondBody);

        var successfulKey = firstResponse.StatusCode == HttpStatusCode.OK ? firstKey : secondKey;
        using var replay = await context.RegisterRefundAsync(clientId, membership.SaleId, 1000m, successfulKey);
        var replayBody = await replay.Content.ReadAsStringAsync();
        Assert.True(replay.StatusCode == HttpStatusCode.OK, replayBody);
        Assert.Equal(1, await context.CountActiveRefundsAsync(membership.SaleId));
        Assert.Equal(targetGroupIds.Length, await context.CountRefundTargetSnapshotsAsync(membership.SaleId));
    }

    [Fact]
    public async Task PostgreSql_attendance_entitlement_snapshots_are_append_only_after_unmark()
    {
        await using var context = await MembershipTargetPostgreSqlContext.CreateAsync();
        var targetGroupIds = context.Seeded.GroupIds.Take(2).ToArray();
        var clientId = await context.SeedClientAsync("attendance-snapshot", targetGroupIds[0]);

        using (var purchase = await context.PurchaseTermAsync(clientId, targetGroupIds, "attendance-purchase"))
        {
            var body = await purchase.Content.ReadAsStringAsync();
            Assert.True(purchase.StatusCode == HttpStatusCode.OK, body);
        }

        using (var present = await context.SaveAttendanceAsync(clientId, targetGroupIds[0], "Present"))
        {
            var body = await present.Content.ReadAsStringAsync();
            Assert.True(present.StatusCode == HttpStatusCode.OK, body);
        }

        var firstSnapshots = await context.LoadAttendanceTargetSnapshotsAsync(clientId, BusinessDate);
        Assert.Equal(targetGroupIds, firstSnapshots.GroupIds);
        Assert.Single(firstSnapshots.AttendanceIds.Distinct());

        using (var unmarked = await context.SaveAttendanceAsync(clientId, targetGroupIds[0], "Unmarked"))
        {
            var body = await unmarked.Content.ReadAsStringAsync();
            Assert.True(unmarked.StatusCode == HttpStatusCode.OK, body);
        }

        Assert.False(await context.HasAttendanceEntryAsync(clientId, targetGroupIds[0], BusinessDate));
        var afterUnmark = await context.LoadAttendanceTargetSnapshotsAsync(clientId, BusinessDate);
        Assert.Equal(firstSnapshots.AttendanceIds, afterUnmark.AttendanceIds);
        Assert.Equal(firstSnapshots.GroupIds, afterUnmark.GroupIds);
        Assert.Equal(firstSnapshots.Positions, afterUnmark.Positions);

        using (var presentAgain = await context.SaveAttendanceAsync(clientId, targetGroupIds[0], "Present"))
        {
            var body = await presentAgain.Content.ReadAsStringAsync();
            Assert.True(presentAgain.StatusCode == HttpStatusCode.OK, body);
        }

        var afterSecondPresent = await context.LoadAttendanceTargetSnapshotsAsync(clientId, BusinessDate);
        Assert.Equal(4, afterSecondPresent.GroupIds.Count);
        Assert.Equal(2, afterSecondPresent.AttendanceIds.Distinct().Count());
        Assert.Equal(targetGroupIds.Concat(targetGroupIds).ToArray(), afterSecondPresent.GroupIds);
    }

    private static void AssertCurrentMembershipTargetOrder(JsonElement root, IReadOnlyList<Guid> expectedGroupIds)
    {
        Assert.False(root.TryGetProperty("currentMembership", out _));
        Assert.False(root.TryGetProperty("currentMembershipSummary", out _));
        var currentMemberships = GetRequiredProperty(root, "currentMemberships");
        var membership = Assert.Single(currentMemberships.EnumerateArray());
        var targetGroups = GetRequiredProperty(membership, "targetGroups").EnumerateArray().ToArray();
        Assert.Equal(expectedGroupIds.Count, targetGroups.Length);
        for (var index = 0; index < expectedGroupIds.Count; index++)
        {
            Assert.Equal(expectedGroupIds[index], GetRequiredProperty(targetGroups[index], "groupId").GetGuid());
            Assert.Equal(index, GetRequiredProperty(targetGroups[index], "position").GetInt32());
        }
    }

    private static void AssertProblemContainsField(string body, string field)
    {
        using var document = JsonDocument.Parse(body);
        var errors = GetRequiredProperty(document.RootElement, "errors");
        Assert.True(errors.TryGetProperty(field, out _), body);
    }

    private static void AssertProblemType(string body, string expectedType)
    {
        using var document = JsonDocument.Parse(body);
        Assert.Equal(expectedType, GetRequiredProperty(document.RootElement, "type").GetString());
    }

    private static void AssertNoProviderLeak(string body)
    {
        Assert.DoesNotContain("Npgsql", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Postgres", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("23P", body, StringComparison.OrdinalIgnoreCase);
    }

    private static JsonElement GetRequiredProperty(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value)
            ? value
            : throw new Xunit.Sdk.XunitException($"Expected JSON property '{propertyName}'. Payload: {element}");
    }

    private sealed class MembershipTargetPostgreSqlContext : IAsyncDisposable
    {
        private readonly PostgreSqlContainer postgreSql;
        private readonly MembershipTargetPostgreSqlAppFactory factory;

        private MembershipTargetPostgreSqlContext(
            PostgreSqlContainer postgreSql,
            MembershipTargetPostgreSqlAppFactory factory,
            HttpClient httpClient,
            string csrfToken,
            SeededData seeded)
        {
            this.postgreSql = postgreSql;
            this.factory = factory;
            HttpClient = httpClient;
            CsrfToken = csrfToken;
            Seeded = seeded;
        }

        public HttpClient HttpClient { get; }
        public string CsrfToken { get; }
        public SeededData Seeded { get; }

        public static async Task<MembershipTargetPostgreSqlContext> CreateAsync(
            MembershipTargetSaveChangesBarrier? saveChangesBarrier = null)
        {
            var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
                .WithDatabase($"gym_crm_task115_{Guid.NewGuid():N}")
                .WithUsername("gym_crm")
                .WithPassword("gym_crm")
                .Build();
            await postgreSql.StartAsync();

            var factory = new MembershipTargetPostgreSqlAppFactory(
                postgreSql.GetConnectionString(),
                saveChangesBarrier);
            var httpClient = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });

            try
            {
                var seeded = await SeedAsync(factory);
                var csrfToken = await LoginAsync(httpClient, seeded.Login, seeded.Password);
                return new MembershipTargetPostgreSqlContext(postgreSql, factory, httpClient, csrfToken, seeded);
            }
            catch
            {
                httpClient.Dispose();
                await factory.DisposeAsync();
                await postgreSql.DisposeAsync();
                throw;
            }
        }

        public async Task<Guid> SeedClientAsync(string suffix, Guid? attendanceGroupId = null)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var client = new Client
            {
                Id = Guid.NewGuid(),
                BranchId = Seeded.BranchId,
                LastName = "TASK-115",
                FirstName = suffix,
                Phone = $"+7115{Random.Shared.NextInt64(1000000000, 9999999999)}",
                Status = ClientStatus.Active,
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            db.Clients.Add(client);

            if (attendanceGroupId.HasValue)
            {
                db.ClientGroups.Add(new ClientGroup
                {
                    ClientId = client.Id,
                    GroupId = attendanceGroupId.Value,
                    BranchId = Seeded.BranchId
                });
                db.ClientGroupAssignments.Add(new ClientGroupAssignment
                {
                    Id = Guid.NewGuid(),
                    ClientId = client.Id,
                    GroupId = attendanceGroupId.Value,
                    ValidFrom = BusinessDate.AddYears(-1),
                    CreatedByUserId = Seeded.ActorId,
                    CreatedAt = FixedUtcNow
                });
            }

            await db.SaveChangesAsync();
            return client.Id;
        }

        public Task<HttpResponseMessage> PurchaseTermAsync(
            Guid clientId,
            IReadOnlyList<Guid> targetGroupIds,
            string idempotencySuffix,
            DateOnly? validFrom = null,
            DateOnly? validTo = null)
        {
            return SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                $"/clients/{clientId}/membership/purchase",
                SerializePurchasePayload(
                    Seeded.TermCatalogItemId,
                    validFrom ?? BusinessDate,
                    validTo ?? BusinessDate.AddDays(30),
                    targetGroupIds,
                    professionalComment: null),
                CsrfToken,
                $"task115-{idempotencySuffix}-{Guid.NewGuid():N}");
        }

        public Task<HttpResponseMessage> PurchaseProfessionalAsync(
            Guid clientId,
            IReadOnlyList<Guid> targetGroupIds,
            string idempotencySuffix)
        {
            return SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                $"/clients/{clientId}/membership/purchase",
                SerializePurchasePayload(
                    Seeded.ProfessionalCatalogItemId,
                    BusinessDate,
                    null,
                    targetGroupIds,
                    "Professional membership for TASK-115 PostgreSQL overlap barrier."),
                CsrfToken,
                $"task115-{idempotencySuffix}-{Guid.NewGuid():N}");
        }

        public async Task<HttpResponseMessage> SaveAttendanceAsync(Guid clientId, Guid groupId, string state)
        {
            var lessonOccurrenceId = await EnsureLessonOccurrenceAsync(groupId, BusinessDate);
            var body = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["trainingDate"] = BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["attendanceMarks"] = new[]
                {
                    new Dictionary<string, object?>
                    {
                        ["clientId"] = clientId,
                        ["state"] = state
                    }
                }
            }, JsonOptions);

            return await SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                $"/attendance/lessons/{lessonOccurrenceId}?lessonDate={BusinessDate:yyyy-MM-dd}",
                body,
                CsrfToken,
                idempotencyKey: null);
        }

        private async Task<Guid> EnsureLessonOccurrenceAsync(Guid groupId, DateOnly lessonDate)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var existing = await db.LessonOccurrences
                .Where(occurrence => occurrence.GroupId == groupId && occurrence.LessonDate == lessonDate)
                .Select(occurrence => (Guid?)occurrence.Id)
                .SingleOrDefaultAsync();
            if (existing.HasValue)
            {
                return existing.Value;
            }

            var group = await db.TrainingGroups
                .AsNoTracking()
                .Where(candidate => candidate.Id == groupId)
                .Select(candidate => new
                {
                    candidate.TrainingStartTime,
                    candidate.DurationMinutes,
                    candidate.HallId
                })
                .SingleAsync();
            var occurrence = new LessonOccurrence
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                LessonDate = lessonDate,
                StartTime = group.TrainingStartTime,
                DurationMinutes = group.DurationMinutes,
                HallId = group.HallId,
                Status = LessonOccurrenceStatus.Scheduled,
                SourceKind = LessonOccurrenceSourceKind.LegacyAttendance,
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            db.LessonOccurrences.Add(occurrence);
            await db.SaveChangesAsync();
            return occurrence.Id;
        }

        public Task<HttpResponseMessage> TransferTargetsAsync(
            Guid clientId,
            Guid sourceGroupId,
            Guid targetGroupId,
            IReadOnlyList<Guid>? expectedMembershipIds,
            string idempotencySuffix)
        {
            var body = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["sourceGroupId"] = sourceGroupId,
                ["targetGroupId"] = targetGroupId,
                ["expectedMembershipIds"] = expectedMembershipIds
            }, JsonOptions);
            var path = expectedMembershipIds is null
                ? $"/clients/{clientId}/membership/targets/transfer/preview"
                : $"/clients/{clientId}/membership/targets/transfer";
            return SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                path,
                body,
                CsrfToken,
                expectedMembershipIds is null ? null : $"task115-{idempotencySuffix}-{Guid.NewGuid():N}");
        }

        public Task<HttpResponseMessage> RegisterRefundAsync(
            Guid clientId,
            Guid saleId,
            decimal amount,
            string idempotencyKey)
        {
            var body = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["amount"] = amount,
                ["refundDate"] = BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            }, JsonOptions);
            return SendRawJsonAsync(
                HttpClient,
                HttpMethod.Post,
                $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                body,
                CsrfToken,
                idempotencyKey);
        }

        public async Task<MembershipTargetSnapshot> LoadCurrentMembershipTargetsAsync(Guid clientId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var membership = await db.ClientMemberships
                .AsNoTracking()
                .Include(candidate => candidate.TargetGroups)
                .Where(candidate => candidate.ClientId == clientId && candidate.ValidTo == null)
                .OrderBy(candidate => candidate.CreatedAt)
                .SingleAsync();

            var targets = membership.TargetGroups.OrderBy(target => target.Position).ToArray();
            return new MembershipTargetSnapshot(
                membership.Id,
                membership.SaleId,
                targets.Select(target => target.GroupId).ToArray(),
                targets.Select(target => target.Position).ToArray());
        }

        public async Task<EventTargetSnapshot> LoadSaleTargetSnapshotsAsync(Guid saleId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var snapshots = await db.ClientMembershipSaleTargetSnapshots
                .AsNoTracking()
                .Where(snapshot => snapshot.SaleId == saleId)
                .OrderBy(snapshot => snapshot.Position)
                .ToArrayAsync();
            return new EventTargetSnapshot(
                snapshots.Select(snapshot => snapshot.GroupId).ToArray(),
                snapshots.Select(snapshot => snapshot.Position).ToArray(),
                snapshots.Select(snapshot => snapshot.Provenance).ToArray());
        }

        public async Task<AttendanceTargetSnapshot> LoadAttendanceTargetSnapshotsAsync(Guid clientId, DateOnly trainingDate)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var snapshots = await db.AttendanceEntitlementTargetSnapshots
                .AsNoTracking()
                .Where(snapshot => snapshot.ClientId == clientId && snapshot.TrainingDate == trainingDate)
                .OrderBy(snapshot => snapshot.CreatedAt)
                .ThenBy(snapshot => snapshot.AttendanceId)
                .ThenBy(snapshot => snapshot.Position)
                .ToArrayAsync();
            return new AttendanceTargetSnapshot(
                snapshots.Select(snapshot => snapshot.AttendanceId).ToArray(),
                snapshots.Select(snapshot => snapshot.TargetGroupId!.Value).ToArray(),
                snapshots.Select(snapshot => snapshot.Position).ToArray());
        }

        public async Task<bool> HasAttendanceEntryAsync(Guid clientId, Guid groupId, DateOnly trainingDate)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.Attendance
                .AsNoTracking()
                .AnyAsync(attendance =>
                    attendance.ClientId == clientId &&
                    attendance.GroupId == groupId &&
                    attendance.TrainingDate == trainingDate);
        }

        public async Task<int> CountCurrentMembershipsAsync(Guid clientId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMemberships
                .AsNoTracking()
                .CountAsync(membership => membership.ClientId == clientId && membership.ValidTo == null);
        }

        public async Task<int> CountSalesAsync(Guid clientId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMembershipSales.AsNoTracking().CountAsync(sale => sale.ClientId == clientId);
        }

        public async Task<int> CountActiveRefundsAsync(Guid saleId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMembershipRefunds.AsNoTracking().CountAsync(refund =>
                refund.SaleId == saleId && refund.CanceledAt == null);
        }

        public async Task<int> CountRefundTargetSnapshotsAsync(Guid saleId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMembershipRefundTargetSnapshots.AsNoTracking().CountAsync(snapshot =>
                db.ClientMembershipRefunds.Any(refund => refund.Id == snapshot.RefundId && refund.SaleId == saleId));
        }

        public async Task AssertNoMembershipWritesAsync(Guid clientId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.False(await db.ClientMemberships.AsNoTracking().AnyAsync(membership => membership.ClientId == clientId));
            Assert.False(await db.ClientMembershipSales.AsNoTracking().AnyAsync(sale => sale.ClientId == clientId));
        }

        public async Task InsertMembershipWithInvalidPositionAsync(Guid clientId, Guid saleId, Guid membershipId)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var sale = CreateSale(
                saleId,
                clientId,
                Seeded.ActorId,
                Seeded.TermCatalogItemId,
                MembershipBehaviorKind.Term,
                grossAmount: 1500m,
                professionalComment: null);
            var membership = CreateMembership(
                membershipId,
                clientId,
                saleId,
                MembershipBehaviorKind.Term,
                BusinessDate,
                BusinessDate.AddDays(30),
                professionalComment: null);
            membership.TargetGroups.Add(new ClientMembershipTargetGroup
            {
                ClientMembershipId = membership.Id,
                GroupId = Seeded.GroupIds[0],
                BranchId = Seeded.BranchId,
                Position = 5
            });

            db.ClientMembershipSales.Add(sale);
            db.ClientMemberships.Add(membership);
            await db.SaveChangesAsync();
        }

        public async Task SeedCurrentMembershipAsync(
            Guid clientId,
            MembershipBehaviorKind behaviorKind,
            IReadOnlyList<Guid> targetGroupIds,
            DateOnly validFrom,
            DateOnly? validTo,
            string? professionalComment = null)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var saleId = Guid.NewGuid();
            var membershipId = Guid.NewGuid();
            var catalogItemId = behaviorKind == MembershipBehaviorKind.Professional
                ? Seeded.ProfessionalCatalogItemId
                : Seeded.TermCatalogItemId;
            var sale = CreateSale(
                saleId,
                clientId,
                Seeded.ActorId,
                catalogItemId,
                behaviorKind,
                grossAmount: behaviorKind == MembershipBehaviorKind.Professional ? 0m : 1500m,
                professionalComment);
            var membership = CreateMembership(
                membershipId,
                clientId,
                saleId,
                behaviorKind,
                validFrom,
                validTo,
                professionalComment);

            for (var index = 0; index < targetGroupIds.Count; index++)
            {
                membership.TargetGroups.Add(new ClientMembershipTargetGroup
                {
                    ClientMembershipId = membershipId,
                    GroupId = targetGroupIds[index],
                    BranchId = Seeded.BranchId,
                    Position = index
                });
                sale.TargetSnapshots.Add(new ClientMembershipSaleTargetSnapshot
                {
                    SaleId = saleId,
                    GroupId = targetGroupIds[index],
                    BranchId = Seeded.BranchId,
                    Position = index,
                    Provenance = "Write"
                });
            }

            db.ClientMembershipSales.Add(sale);
            db.ClientMemberships.Add(membership);
            await db.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            HttpClient.Dispose();
            await factory.DisposeAsync();
            await postgreSql.DisposeAsync();
        }

        private static ClientMembershipSale CreateSale(
            Guid saleId,
            Guid clientId,
            Guid actorId,
            Guid catalogItemId,
            MembershipBehaviorKind behaviorKind,
            decimal grossAmount,
            string? professionalComment)
        {
            return new ClientMembershipSale
            {
                Id = saleId,
                ClientId = clientId,
                MembershipCatalogItemId = catalogItemId,
                BehaviorKind = behaviorKind,
                PricingMode = ClientMembershipSalePricingMode.Catalog,
                PurchaseDate = BusinessDate,
                PaymentDate = BusinessDate,
                GrossAmount = grossAmount,
                CreatedByUserId = actorId,
                CreatedAt = FixedUtcNow,
                Comment = professionalComment
            };
        }

        private ClientMembership CreateMembership(
            Guid membershipId,
            Guid clientId,
            Guid saleId,
            MembershipBehaviorKind behaviorKind,
            DateOnly validFrom,
            DateOnly? validTo,
            string? professionalComment)
        {
            return new ClientMembership
            {
                Id = membershipId,
                ClientId = clientId,
                SaleId = saleId,
                BehaviorKind = behaviorKind,
                IndividualValidFrom = validFrom,
                IndividualValidTo = validTo,
                ProfessionalComment = professionalComment,
                SingleVisitUsed = false,
                ValidFrom = FixedUtcNow,
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ChangedByUserId = Seeded.ActorId,
                CreatedAt = FixedUtcNow
            };
        }

        private static async Task<SeededData> SeedAsync(MembershipTargetPostgreSqlAppFactory factory)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            await db.Database.MigrateAsync();

            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            const string password = "task115-membership-target-password";
            var branch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "TASK-115 PG Branch",
                IsArchived = false,
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            var hall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = branch.Id,
                Name = "TASK-115 PG Hall",
                IsArchived = false,
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            var groupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "TASK-115 PG Group Type",
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            var groups = Enumerable.Range(1, 6)
                .Select(index => new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = branch.Id,
                    HallId = hall.Id,
                    GroupTypeId = groupType.Id,
                    Name = $"TASK-115 PG Group {index}",
                    TrainingStartTime = new TimeOnly(9 + index, 0),
                    DurationMinutes = 60,
                    Weekdays = [1, 3, 5],
                    IsActive = true,
                    CreatedAt = FixedUtcNow,
                    UpdatedAt = FixedUtcNow
                })
                .ToArray();
            var actor = new User
            {
                Id = Guid.NewGuid(),
                FullName = "TASK-115 Head Coach",
                Login = $"task115-headcoach-{Guid.NewGuid():N}",
                Role = UserRole.HeadCoach,
                MustChangePassword = false,
                IsActive = true,
                CreatedAt = FixedUtcNow,
                UpdatedAt = FixedUtcNow
            };
            actor.PasswordHash = passwordHashService.HashPassword(actor, password);
            var termCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                branch.Id,
                "TASK-115 Term",
                1500m,
                MembershipBehaviorKind.Term,
                BusinessDate.AddYears(-1),
                null,
                FixedUtcNow);
            var professionalCatalogItemId = await db.MembershipCatalogItems
                .Where(item => item.BehaviorKind == MembershipBehaviorKind.Professional)
                .Select(item => item.Id)
                .SingleAsync();

            db.Branches.Add(branch);
            db.Halls.Add(hall);
            db.GroupTypes.Add(groupType);
            db.TrainingGroups.AddRange(groups);
            db.Users.Add(actor);
            db.MembershipCatalogItems.Add(termCatalogItem);
            await db.SaveChangesAsync();

            return new SeededData(
                actor.Id,
                actor.Login,
                password,
                branch.Id,
                termCatalogItem.Id,
                professionalCatalogItemId,
                groups.Select(group => group.Id).ToArray());
        }

        private static async Task<string> LoginAsync(HttpClient httpClient, string login, string password)
        {
            using var initialSessionResponse = await httpClient.GetAsync("/auth/session");
            Assert.Equal(HttpStatusCode.OK, initialSessionResponse.StatusCode);
            using var initialSessionDocument = JsonDocument.Parse(await initialSessionResponse.Content.ReadAsStringAsync());
            var csrfToken = GetRequiredProperty(initialSessionDocument.RootElement, "csrfToken").GetString();
            Assert.False(string.IsNullOrWhiteSpace(csrfToken));

            using var loginResponse = await SendRawJsonAsync(
                httpClient,
                HttpMethod.Post,
                "/auth/login",
                JsonSerializer.Serialize(new { login, password }, JsonOptions),
                csrfToken!,
                idempotencyKey: null);
            var body = await loginResponse.Content.ReadAsStringAsync();
            Assert.True(loginResponse.StatusCode == HttpStatusCode.OK, body);
            using var loginDocument = JsonDocument.Parse(body);
            return GetRequiredProperty(loginDocument.RootElement, "csrfToken").GetString()
                ?? throw new Xunit.Sdk.XunitException("Authenticated session did not return a CSRF token.");
        }
    }

    private sealed class MembershipTargetPostgreSqlAppFactory(
        string connectionString,
        MembershipTargetSaveChangesBarrier? saveChangesBarrier) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = connectionString,
                    ["Persistence:ApplyMigrationsOnStartup"] = "true",
                    ["BootstrapUser:Login"] = "task115-postgres-bootstrap",
                    ["BootstrapUser:FullName"] = "TASK-115 PG Bootstrap",
                    ["ClientPhoto:StorageRootPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-task115-postgres-{Guid.NewGuid():N}"),
                    ["TechnicalLogging:DirectoryPath"] = Path.Combine(
                        Path.GetTempPath(),
                        $"gym-crm-task115-technical-{Guid.NewGuid():N}")
                }));

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                services.AddDbContext<GymCrmDbContext>(options =>
                {
                    options.UseNpgsql(connectionString);
                    if (saveChangesBarrier is not null)
                    {
                        options.AddInterceptors(saveChangesBarrier);
                    }
                });
                if (saveChangesBarrier is not null)
                {
                    services.AddSingleton(saveChangesBarrier);
                }

                services.RemoveAll<IBusinessDateProvider>();
                services.AddSingleton<IBusinessDateProvider>(new FixedBusinessDateProvider(BusinessDate));
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(new FixedTimeProvider(FixedUtcNow));
            });
        }
    }

    private sealed class MembershipTargetSaveChangesBarrier : SaveChangesInterceptor
    {
        private readonly TaskCompletionSource waitForSecondAttempt = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int membershipSaveAttempts;

        public async Task WaitForTwoMembershipSaveAttemptsAsync()
        {
            var timeout = Task.Delay(TimeSpan.FromSeconds(20));
            if (await Task.WhenAny(waitForSecondAttempt.Task, timeout) != waitForSecondAttempt.Task)
            {
                throw new TimeoutException("Timed out waiting for two concurrent membership save attempts.");
            }
        }

        public void Release()
        {
            release.TrySetResult();
        }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (IsMembershipMutationSaveAttempt(eventData.Context))
            {
                var attempt = Interlocked.Increment(ref membershipSaveAttempts);
                if (attempt >= 2)
                {
                    waitForSecondAttempt.TrySetResult();
                }

                await release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken);
            }

            return await base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private static bool IsMembershipMutationSaveAttempt(DbContext? context)
        {
            return context?.ChangeTracker.Entries().Any(entry =>
                entry.State is EntityState.Added or EntityState.Modified &&
                entry.Entity is ClientMembership or ClientMembershipSale or ClientMembershipTargetGroup or ClientMembershipSaleTargetSnapshot) == true;
        }
    }

    private static string SerializePurchasePayload(
        Guid catalogItemId,
        DateOnly validFrom,
        DateOnly? validTo,
        IReadOnlyList<Guid> targetGroupIds,
        string? professionalComment)
    {
        return JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["membershipCatalogItemId"] = catalogItemId,
            ["validFrom"] = validFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["validTo"] = validTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["paymentDate"] = BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["targetGroupIds"] = targetGroupIds,
            ["professionalComment"] = professionalComment
        }, JsonOptions);
    }

    private static async Task<HttpResponseMessage> SendRawJsonAsync(
        HttpClient httpClient,
        HttpMethod method,
        string path,
        string rawJson,
        string csrfToken,
        string? idempotencyKey)
    {
        using var request = new HttpRequestMessage(method, path)
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        return await httpClient.SendAsync(request);
    }

    private sealed record SeededData(
        Guid ActorId,
        string Login,
        string Password,
        Guid BranchId,
        Guid TermCatalogItemId,
        Guid ProfessionalCatalogItemId,
        IReadOnlyList<Guid> GroupIds);

    private sealed record MembershipTargetSnapshot(
        Guid MembershipId,
        Guid SaleId,
        IReadOnlyList<Guid> TargetGroupIds,
        IReadOnlyList<int> Positions);

    private sealed record EventTargetSnapshot(
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<int> Positions,
        IReadOnlyList<string> Provenance);

    private sealed record AttendanceTargetSnapshot(
        IReadOnlyList<Guid> AttendanceIds,
        IReadOnlyList<Guid> GroupIds,
        IReadOnlyList<int> Positions);

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
