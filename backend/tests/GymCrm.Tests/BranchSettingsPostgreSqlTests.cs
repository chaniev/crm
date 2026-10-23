using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class BranchSettingsPostgreSqlTests
{
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
