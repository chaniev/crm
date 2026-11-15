using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public class ClientImportPostgreSqlTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("SaveChanges")]
    [InlineData("ClientCreated")]
    [InlineData("ClientNoteChanged")]
    [InlineData("ClientImportCompleted")]
    public async Task Whole_file_and_audit_commit_together(string? failureAction)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), new FailImportAudit(failureAction));
        await factory.SeedAsync();
        await SeedGroupAsync(factory);
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        {
            var operation = Guid.NewGuid();
            using var response = await SendImportAsync(client, token, factory.OwnBranchId, operation);
            Assert.Equal(failureAction is null ? HttpStatusCode.OK : HttpStatusCode.InternalServerError, response.StatusCode);
            if (failureAction is null)
            {
                var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
                Assert.Equal(operation, payload.GetProperty("operationId").GetGuid());
                Assert.Equal(2, payload.GetProperty("createdCount").GetInt32());
            }
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var expected = failureAction is null ? 2 : 0;
        Assert.Equal(expected, await db.Clients.CountAsync());
        Assert.Equal(expected, await db.ClientGroups.CountAsync());
        Assert.Equal(expected, await db.ClientGroupAssignments.CountAsync());
        Assert.Equal(expected, await db.ClientBranchAssignments.CountAsync());
        Assert.Equal(expected, await db.AuditLogs.CountAsync(a => a.ActionType == "ClientCreated"));
        Assert.Equal(expected, await db.AuditLogs.CountAsync(a => a.ActionType == "ClientNoteChanged"));
        Assert.Equal(failureAction is null ? 1 : 0, await db.AuditLogs.CountAsync(a => a.ActionType == "ClientImportCompleted"));
        Assert.Empty(await db.ClientContacts.ToArrayAsync());
        Assert.Empty(await db.ClientMembershipSales.ToArrayAsync());
    }

    [Theory]
    [InlineData(48)]
    [InlineData(66)]
    public async Task Corrected_profiles_create_N_and_deliberate_repeat_creates_2N(int count)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        await SeedGroupAsync(factory);
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        {
            using var invalid = await SendImportAsync(client, token, factory.OwnBranchId, Guid.NewGuid(), SyntheticImportProfiles.Rows(count, false));
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            using (var scope = factory.Services.CreateScope()) Assert.Empty(await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>().Clients.ToArrayAsync());
            for (var run = 0; run < 2; run++)
            {
                using var success = await SendImportAsync(client, token, factory.OwnBranchId, Guid.NewGuid(), SyntheticImportProfiles.Rows(count, true));
                Assert.Equal(HttpStatusCode.OK, success.StatusCode);
                Assert.Equal(count, (await success.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("createdCount").GetInt32());
            }
        }
        using var verify = factory.Services.CreateScope();
        var db = verify.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(2 * count, await db.Clients.CountAsync());
        Assert.Equal(2, await db.AuditLogs.CountAsync(a => a.ActionType == "ClientImportCompleted"));
        Assert.True(await db.Clients.AllAsync(c => c.NotesChangedAt != null && c.NotesChangedByUserId != null));
        Assert.Empty(await db.ClientContacts.ToArrayAsync());
        Assert.Empty(await db.ClientMembershipSales.ToArrayAsync());
    }

    [Theory]
    [InlineData("deactivate")]
    [InlineData("branch")]
    [InlineData("role")]
    [InlineData("rename")]
    [InlineData("move")]
    [InlineData("delete")]
    [InlineData("replace")]
    public async Task Waiting_import_rechecks_actor_and_original_group_identity(string change)
    {
        var barrier = new ImportLockBarrier();
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString(), barrier);
        await factory.SeedAsync();
        var groupId = await SeedGroupAsync(factory);
        var (client, token) = await factory.LoginAsync(UserRole.SuperAdministrator);
        using (client)
        {
            barrier.Armed = true;
            var pending = SendImportAsync(client, token, factory.OwnBranchId, Guid.NewGuid());
            await barrier.Entered.Task.WaitAsync(TimeSpan.FromSeconds(20));
            try
            {
                using var scope = factory.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                var actor = await db.Users.SingleAsync(u => u.Role == UserRole.SuperAdministrator);
                var group = await db.TrainingGroups.SingleAsync(g => g.Id == groupId);
                if (change == "deactivate") actor.IsActive = false;
                if (change == "branch") { actor.Role = UserRole.Administrator; actor.BranchId = factory.ForeignBranchId; }
                if (change == "role") actor.Role = UserRole.HeadCoach;
                if (change == "rename") group.Name = "Renamed";
                if (change == "move") await db.TrainingGroups.Where(g => g.Id == groupId).ExecuteUpdateAsync(setters => setters.SetProperty(g => g.BranchId, factory.ForeignBranchId).SetProperty(g => g.HallId, factory.ForeignHallId));
                if (change is "delete" or "replace") db.TrainingGroups.Remove(group);
                await db.SaveChangesAsync();
                if (change == "replace")
                {
                    db.TrainingGroups.Add(new TrainingGroup { Id = Guid.NewGuid(), Name = "Import group", BranchId = factory.OwnBranchId, HallId = factory.OwnHallId, GroupTypeId = group.GroupTypeId, DurationMinutes = 60, Weekdays = [1], TrainingStartTime = new TimeOnly(18, 0), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
                    await db.SaveChangesAsync();
                }
            }
            finally { barrier.Release.TrySetResult(); }
            using var response = await pending.WaitAsync(TimeSpan.FromSeconds(20));
            Assert.Equal(change is "deactivate" or "branch" or "role" ? HttpStatusCode.Forbidden : HttpStatusCode.Conflict, response.StatusCode);
        }
        using var verify = factory.Services.CreateScope();
        var context = verify.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await context.Clients.ToArrayAsync());
        Assert.Empty(await context.AuditLogs.Where(log => log.ActionType.StartsWith("Client")).ToArrayAsync());
    }

    private sealed class ImportLockBarrier : DbCommandInterceptor
    {
        public bool Armed { get; set; }
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Armed && command.CommandText.Contains("FOR SHARE", StringComparison.Ordinal))
            {
                Armed = false;
                Entered.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken);
            }
            return result;
        }
    }

    internal static async Task<Guid> SeedGroupAsync(BranchSettingsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var now = DateTimeOffset.UtcNow;
        var type = new GroupType { Id = Guid.NewGuid(), Name = "Import type", CreatedAt = now, UpdatedAt = now };
        db.GroupTypes.Add(type);
        var group = new TrainingGroup { Id = Guid.NewGuid(), Name = "Import group", BranchId = factory.OwnBranchId, HallId = factory.OwnHallId, GroupTypeId = type.Id, DurationMinutes = 60, Weekdays = [1], TrainingStartTime = new TimeOnly(18, 0), CreatedAt = now, UpdatedAt = now };
        db.TrainingGroups.Add(group);
        await db.SaveChangesAsync();
        return group.Id;
    }

    internal static async Task<HttpResponseMessage> SendImportAsync(HttpClient client, string token, Guid branch, Guid operation, string[][]? rows = null)
    {
        using var file = ClientXlsxReaderTests.Workbook(rows ?? [ClientXlsxReaderTests.ValidRow(), ClientXlsxReaderTests.ValidRow()]);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/clients/import-xlsx");
        request.Headers.Add("X-CSRF-TOKEN", token);
        request.Content = new MultipartFormDataContent
        {
            { new StringContent(branch.ToString()), "branchId" },
            { new StringContent(operation.ToString()), "operationId" },
            { new StringContent(" Import group "), "groupName" },
            { new ByteArrayContent(file.ToArray()), "file", "arbitrary-name.xlsx" }
        };
        return await client.SendAsync(request);
    }

    private sealed class FailImportAudit(string? action) : SaveChangesInterceptor
    {
        private int matches;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            var matchesAction = action == "SaveChanges"
                ? eventData.Context!.ChangeTracker.Entries<GymCrm.Domain.Clients.Client>().Any(entry => entry.State == EntityState.Added)
                : action is not null && eventData.Context!.ChangeTracker.Entries<GymCrm.Domain.Audit.AuditLog>()
                    .Any(entry => entry.State == EntityState.Added && entry.Entity.ActionType == action);
            if (matchesAction && ++matches == (action == "ClientImportCompleted" ? 1 : 2))
                throw new InvalidOperationException("Injected late import failure");
            return ValueTask.FromResult(result);
        }
    }
}
