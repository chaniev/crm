using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class BranchSettingsPostgreSqlTests
{
    [Theory]
    [InlineData(UserRole.HeadCoach, false)]
    [InlineData(UserRole.HeadCoach, true)]
    [InlineData(UserRole.SuperAdministrator, false)]
    [InlineData(UserRole.SuperAdministrator, true)]
    [InlineData(UserRole.Administrator, false)]
    [InlineData(UserRole.Administrator, true)]
    public async Task Branch_list_preserves_archive_filter_sort_order_and_scoped_counts(UserRole role, bool includeArchived)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var firstTiedBranchId = Guid.Parse("10000000-0000-0000-0000-000000000001");
        var secondTiedBranchId = Guid.Parse("10000000-0000-0000-0000-000000000002");
        var archivedBranchId = Guid.Parse("10000000-0000-0000-0000-000000000003");
        var timestamp = new DateTimeOffset(2026, 10, 25, 0, 0, 0, TimeSpan.Zero);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            (await db.Branches.SingleAsync(branch => branch.Id == factory.OwnBranchId)).Name = "Zulu";
            (await db.Branches.SingleAsync(branch => branch.Id == factory.ForeignBranchId)).Name = "Alpha";
            db.Branches.AddRange(
                new Branch { Id = secondTiedBranchId, Name = "Beta", CreatedAt = timestamp, UpdatedAt = timestamp },
                new Branch { Id = firstTiedBranchId, Name = "Beta", CreatedAt = timestamp, UpdatedAt = timestamp },
                new Branch { Id = archivedBranchId, Name = "Aardvark", IsArchived = true, CreatedAt = timestamp, UpdatedAt = timestamp });
            db.Clients.AddRange(
                new Client { Id = Guid.Parse("20000000-0000-0000-0000-000000000001"), BranchId = factory.OwnBranchId, FirstName = "Own one", Phone = "+70000000001", CreatedAt = timestamp, UpdatedAt = timestamp },
                new Client { Id = Guid.Parse("20000000-0000-0000-0000-000000000002"), BranchId = factory.OwnBranchId, FirstName = "Own two", Phone = "+70000000002", CreatedAt = timestamp, UpdatedAt = timestamp },
                new Client { Id = Guid.Parse("20000000-0000-0000-0000-000000000003"), BranchId = factory.ForeignBranchId, FirstName = "Foreign", Phone = "+70000000003", CreatedAt = timestamp, UpdatedAt = timestamp },
                new Client { Id = Guid.Parse("20000000-0000-0000-0000-000000000004"), BranchId = archivedBranchId, FirstName = "Archived branch", Phone = "+70000000004", CreatedAt = timestamp, UpdatedAt = timestamp });
            await db.SaveChangesAsync();
        }

        var (client, _) = await factory.LoginAsync(role);
        using (client)
        using (var response = await client.GetAsync(includeArchived ? "/branches?includeArchived=true" : "/branches"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var branches = payload.EnumerateArray().ToArray();
            Guid[] activeBranchIds = [factory.ForeignBranchId, firstTiedBranchId, secondTiedBranchId, factory.OwnBranchId];
            Guid[] expectedBranchIds = includeArchived ? [.. activeBranchIds, archivedBranchId] : activeBranchIds;
            Assert.Equal(expectedBranchIds, branches.Select(branch => branch.GetProperty("id").GetGuid()));
            Assert.Equal(includeArchived ? 1 : 0, branches.Count(branch => branch.GetProperty("isArchived").GetBoolean()));
            foreach (var branch in branches)
            {
                var branchId = branch.GetProperty("id").GetGuid();
                var count = branch.GetProperty("clientCount");
                if (role == UserRole.Administrator && branchId != factory.OwnBranchId)
                {
                    Assert.Equal(JsonValueKind.Null, count.ValueKind);
                }
                else
                {
                    var expectedCount = branchId == factory.OwnBranchId ? 2 : branchId == factory.ForeignBranchId || branchId == archivedBranchId ? 1 : 0;
                    Assert.Equal(expectedCount, count.GetInt32());
                }
            }
        }
    }

    [Theory]
    [InlineData("/branches", "BranchCreated")]
    [InlineData("/halls", "HallCreated")]
    public async Task Audit_insert_failure_rolls_back_created_entity(string path, string action)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var interceptor = new CreateAuditFailureInterceptor(action);
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), interceptor);
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.SuperAdministrator);
        using (client)
        using (var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, path,
                   new { name = "Must rollback", branchId = factory.OwnBranchId }, token))
        {
            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        }
        Assert.True(interceptor.EntityInsertObserved);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await db.Branches.AnyAsync(x => x.Name == "Must rollback"));
        Assert.False(await db.Halls.AnyAsync(x => x.Name == "Must rollback"));
        Assert.False(await db.AuditLogs.AnyAsync(x => x.ActionType == action));
        Assert.True(await db.AuditLogs.AnyAsync(x => x.ActionType == "Login"));
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(false, false)]
    public async Task Hall_command_waits_for_schedule_writer(bool archive, bool commitSchedule)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var connectionString = postgres.GetConnectionString();
        await using var factory = new BranchSettingsAppFactory(connectionString);
        await factory.SeedAsync();
        var groupId = await factory.SeedGroupInAnotherHallAsync();
        var (client, token) = await factory.LoginAsync(UserRole.HeadCoach);
        using var hallClient = client;
        using var writerScope = factory.Services.CreateScope();
        var writer = writerScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        await using var transaction = await writer.Database.BeginTransactionAsync();
        // Both tables have a restrictive FK. Exercise one through each command.
        if (archive)
        {
            writer.LessonOccurrences.Add(new LessonOccurrence
            {
                GroupId = groupId,
                HallId = factory.OwnHallId,
                LessonDate = new DateOnly(2020, 8, 10),
                StartTime = new TimeOnly(9, 0),
                DurationMinutes = 60,
                SourceKind = LessonOccurrenceSourceKind.OneOff
            });
        }
        else
        {
            var start = new DateOnly(2020, 8, 10);
            writer.LessonScheduleSlots.Add(new LessonScheduleSlot
            {
                RuleVersion = new LessonScheduleRuleVersion
                {
                    LessonSeries = new LessonSeries { GroupId = groupId, StartsOn = start },
                    VersionNumber = 1,
                    EffectiveFrom = start
                },
                HallId = factory.OwnHallId,
                SlotLineageId = Guid.NewGuid(),
                IsoWeekday = 1,
                StartTime = new TimeOnly(9, 0),
                DurationMinutes = 60
            });
        }
        await writer.SaveChangesAsync();

        var path = $"/halls/{factory.OwnHallId}";
        var request = BranchSettingsAppFactory.SendAsync(hallClient, archive ? HttpMethod.Put : HttpMethod.Delete,
            archive ? path + "/archive" : path, null, token);
        var writerPid = ((NpgsqlConnection)writer.Database.GetDbConnection()).ProcessID;
        await WaitForHallCommandAsync(connectionString, writerPid, request);
        if (commitSchedule)
        {
            await transaction.CommitAsync();
        }
        else
        {
            await transaction.RollbackAsync();
        }

        using var response = await request.WaitAsync(TimeSpan.FromSeconds(10));
        using var checkScope = factory.Services.CreateScope();
        var db = checkScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var hall = await db.Halls.SingleOrDefaultAsync(x => x.Id == factory.OwnHallId);
        var audits = await db.AuditLogs.Where(x => x.EntityId == factory.OwnHallId.ToString()).Select(x => x.ActionType).ToListAsync();
        var hasLink = archive
            ? await db.LessonOccurrences.AnyAsync(x => x.HallId == factory.OwnHallId)
            : await db.LessonScheduleSlots.AnyAsync(x => x.HallId == factory.OwnHallId);
        Assert.Equal(commitSchedule, hasLink);
        if (commitSchedule)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Contains("расписани", payload.GetProperty("errors").GetProperty("hall")[0].GetString());
            Assert.False(Assert.IsType<Hall>(hall).IsArchived);
            Assert.Empty(audits);
        }
        else
        {
            Assert.Equal(archive ? HttpStatusCode.OK : HttpStatusCode.NoContent, response.StatusCode);
            Assert.Equal(archive ? true : (bool?)null, hall?.IsArchived);
            Assert.Equal(archive ? "HallArchived" : "HallDeleted", Assert.Single(audits));
        }
    }

    private static async Task WaitForHallCommandAsync(string connectionString, int writerPid, Task<HttpResponseMessage> request)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var observer = new NpgsqlConnection(connectionString);
        await observer.OpenAsync(timeout.Token);
        await using var command = new NpgsqlCommand("""
            SELECT EXISTS (SELECT 1 FROM pg_stat_activity
                WHERE datname = current_database() AND $1 = ANY(pg_blocking_pids(pid)))
            """, observer);
        command.Parameters.Add(new NpgsqlParameter<int> { TypedValue = writerPid });
        while (await command.ExecuteScalarAsync(timeout.Token) is not true)
        {
            Assert.False(request.IsCompleted, "Hall command finished before the schedule transaction released its lock.");
            await Task.Delay(25, timeout.Token);
        }
    }

    [Fact]
    public async Task SuperAdministrator_creates_two_branches_and_halls_with_durable_audit_and_scope_denial()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.SuperAdministrator);
        var created = new List<(Guid Id, string Entity, string Action)>();
        using (client)
        {
            for (var index = 0; index < 2; index++)
            {
                using var branchResponse = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/branches",
                    new { name = $"Created branch {index}", address = "Address", description = "Description" }, token);
                Assert.Equal(HttpStatusCode.Created, branchResponse.StatusCode);
                var branch = await branchResponse.Content.ReadFromJsonAsync<JsonElement>();
                var branchId = branch.GetProperty("id").GetGuid();
                created.Add((branchId, "Branch", "BranchCreated"));
                using var hallResponse = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/halls",
                    new { branchId, name = $"Created hall {index}", description = "Hall description" }, token);
                Assert.Equal(HttpStatusCode.Created, hallResponse.StatusCode);
                var hall = await hallResponse.Content.ReadFromJsonAsync<JsonElement>();
                Assert.Equal(branchId, hall.GetProperty("branchId").GetGuid());
                created.Add((hall.GetProperty("id").GetGuid(), "Hall", "HallCreated"));
            }
        }
        var (reader, _) = await factory.LoginAsync(UserRole.SuperAdministrator);
        using (reader)
        {
            foreach (var item in created)
            {
                var resource = item.Entity == "Branch" ? "branches" : "halls";
                var reloaded = await reader.GetFromJsonAsync<JsonElement>($"/{resource}/{item.Id}");
                Assert.Equal(item.Id, reloaded.GetProperty("id").GetGuid());
            }
        }
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(x => x.Role == UserRole.SuperAdministrator);
            Assert.Null(actor.BranchId);
            foreach (var item in created)
            {
                var audit = await db.AuditLogs.SingleAsync(x => x.EntityId == item.Id.ToString() && x.ActionType == item.Action);
                Assert.Equal(actor.Id, audit.UserId);
                Assert.Equal(item.Entity, audit.EntityType);
                Assert.Null(audit.OldValueJson);
                using var snapshot = JsonDocument.Parse(audit.NewValueJson!);
                Assert.Equal(item.Id, snapshot.RootElement.GetProperty("id").GetGuid());
                Assert.False(snapshot.RootElement.GetProperty("isArchived").GetBoolean());
                Assert.StartsWith("Created ", snapshot.RootElement.GetProperty("name").GetString());
            }
        }
        var (admin, adminToken) = await factory.LoginAsync(UserRole.Administrator);
        using (admin)
        using (var denied = await BranchSettingsAppFactory.SendAsync(admin, HttpMethod.Put, $"/branches/{created[0].Id}", new { name = "Forbidden" }, adminToken))
        {
            await BranchSettingsApiTests.AssertScopeDeniedAsync(denied);
        }
        using var checkScope = factory.Services.CreateScope();
        var checkDb = checkScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal("Created branch 0", (await checkDb.Branches.SingleAsync(x => x.Id == created[0].Id)).Name);
        Assert.False(await checkDb.AuditLogs.AnyAsync(x => x.EntityId == created[0].Id.ToString() && x.ActionType == "BranchUpdated"));
    }

    private sealed class CreateAuditFailureInterceptor(string action) : SaveChangesInterceptor
    {
        public bool EntityInsertObserved { get; private set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            var db = (GymCrmDbContext)eventData.Context!;
            var audit = db.ChangeTracker.Entries<AuditLog>().SingleOrDefault(x => x.State == EntityState.Added && x.Entity.ActionType == action)?.Entity;
            if (audit is not null)
            {
                var id = Guid.Parse(audit.EntityId!);
                EntityInsertObserved = action == "BranchCreated"
                    ? await db.Branches.AsNoTracking().AnyAsync(x => x.Id == id, cancellationToken)
                    : await db.Halls.AsNoTracking().AnyAsync(x => x.Id == id, cancellationToken);
                throw new DbUpdateException("Injected mandatory create audit insert failure.");
            }
            return result;
        }
    }
}
