using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public class BranchSettingsApiTests
{
    [Theory]
    [InlineData("branch-create")]
    [InlineData("branch-update")]
    [InlineData("branch-archive")]
    [InlineData("branch-restore")]
    [InlineData("hall-create")]
    [InlineData("hall-update")]
    [InlineData("hall-archive")]
    [InlineData("hall-restore")]
    [InlineData("hall-delete")]
    public async Task Administrator_foreign_or_global_mutation_is_forbidden_without_writes(string operation)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        {
            var before = await SnapshotAsync(factory);
            using var response = await MutateAsync(factory, client, token, operation, foreign: true);
            await AssertScopeDeniedAsync(response);
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    [InlineData(UserRole.Administrator)]
    public async Task Allowed_mutations_preserve_crud_and_shared_lookup_contract(UserRole role)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(role);
        using (client)
        {
            foreach (var operation in new[] { "branch-update", "branch-archive", "branch-restore", "hall-create", "hall-update", "hall-archive", "hall-restore", "hall-delete" })
            {
                using var response = await MutateAsync(factory, client, token, operation, foreign: role != UserRole.Administrator);
                Assert.True(response.IsSuccessStatusCode, $"{role} {operation}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}");
            }
            using var branch = await client.GetAsync($"/branches/{factory.ForeignBranchId}");
            Assert.Equal(HttpStatusCode.OK, branch.StatusCode);
            var branches = await client.GetFromJsonAsync<JsonElement>("/branches?includeArchived=true");
            Assert.Equal(2, branches.GetArrayLength());
            var unknown = await client.GetFromJsonAsync<JsonElement>($"/halls?branchId={Guid.NewGuid()}");
            Assert.Equal(0, unknown.GetArrayLength());
            using var missing = await client.GetAsync($"/halls/{Guid.NewGuid()}");
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        }
    }

    [Theory]
    [InlineData("branch-update")]
    [InlineData("branch-archive")]
    [InlineData("branch-restore")]
    [InlineData("hall-update")]
    [InlineData("hall-archive")]
    [InlineData("hall-restore")]
    [InlineData("hall-delete")]
    public async Task Missing_target_is_404_before_payload_validation(string operation)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        using (var response = await MutateAsync(factory, client, token, operation, missing: true))
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }

    [Theory]
    [InlineData("null")]
    [InlineData("empty")]
    [InlineData("foreign")]
    [InlineData("missing")]
    public async Task Administrator_hall_parent_scope_precedes_validation(string parent)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        Guid? branchId = parent switch { "null" => null, "empty" => Guid.Empty, "foreign" => factory.ForeignBranchId, _ => Guid.NewGuid() };
        using (client)
        {
            var before = await SnapshotAsync(factory);
            using var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/halls", new { branchId, name = "" }, token);
            await AssertScopeDeniedAsync(response);
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Fact]
    public async Task Administrator_scope_comes_from_current_user_and_persisted_hall()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        {
            using var tampered = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Put, $"/halls/{factory.ForeignHallId}?branchId={factory.OwnBranchId}",
                new { branchId = factory.OwnBranchId, name = "" }, token);
            await AssertScopeDeniedAsync(tampered);
            using var own = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Put, $"/halls/{factory.OwnHallId}",
                new { branchId = factory.ForeignBranchId, name = "Renamed" }, token);
            Assert.Equal(HttpStatusCode.BadRequest, own.StatusCode);
            Assert.True((await own.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").TryGetProperty("branchId", out _));
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                (await db.Users.SingleAsync(u => u.Role == UserRole.Administrator)).BranchId = null;
                await db.SaveChangesAsync();
            }
            var before = await SnapshotAsync(factory);
            foreach (var operation in new[] { "branch-create", "branch-update", "branch-archive", "branch-restore", "hall-create", "hall-update", "hall-archive", "hall-restore", "hall-delete" })
            {
                using var denied = await MutateAsync(factory, client, token, operation);
                await AssertScopeDeniedAsync(denied);
            }
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    [InlineData(UserRole.Administrator)]
    [InlineData(UserRole.Coach)]
    public async Task Session_actions_are_consistent_for_login_session_and_password_change(UserRole role)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(null);
        using (client)
        {
            var anonymous = await client.GetFromJsonAsync<JsonElement>("/auth/session");
            Assert.Equal(JsonValueKind.Null, anonymous.GetProperty("user").ValueKind);
            using var login = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/auth/login", new { login = role.ToString(), password = BranchSettingsAppFactory.Password }, token);
            login.EnsureSuccessStatusCode();
            var first = await login.Content.ReadFromJsonAsync<JsonElement>();
            var expected = role switch
            {
                UserRole.HeadCoach => new[] { "View", "CreateBranch", "UpdateBranch", "ArchiveBranch", "RestoreBranch", "CreateHall", "UpdateHall", "ArchiveHall", "RestoreHall", "DeleteHall" },
                UserRole.SuperAdministrator => new[] { "View", "CreateBranch", "CreateHall" },
                _ => []
            };
            AssertActions(first, expected);
            AssertActions(await client.GetFromJsonAsync<JsonElement>("/auth/session"), expected);
            using var changed = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/auth/change-password",
                new { currentPassword = BranchSettingsAppFactory.Password, newPassword = "changed-password" }, first.GetProperty("csrfToken").GetString());
            changed.EnsureSuccessStatusCode();
            AssertActions(await changed.Content.ReadFromJsonAsync<JsonElement>(), expected);
            var roleOptions = first.GetProperty("user").GetProperty("createRoleOptions").EnumerateArray().Select(x => x.GetString()).ToArray();
            Assert.Equal(role == UserRole.HeadCoach, roleOptions.Contains("SuperAdministrator"));
        }
    }

    [Theory]
    [InlineData(UserRole.Coach)]
    [InlineData(null)]
    public async Task Create_rejects_coach_and_anonymous_without_writes(UserRole? role)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(role);
        using (client)
        {
            var before = await SnapshotAsync(factory);
            foreach (var path in new[] { "/branches", "/halls" })
            {
                using var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, path, new { name = "Forbidden", branchId = factory.OwnBranchId }, token);
                Assert.Equal(role.HasValue ? HttpStatusCode.Forbidden : HttpStatusCode.Unauthorized, response.StatusCode);
            }
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("invalid")]
    public async Task Create_requires_valid_csrf(string? token)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, _) = await factory.LoginAsync(UserRole.SuperAdministrator);
        using (client)
        {
            var before = await SnapshotAsync(factory);
            foreach (var path in new[] { "/branches", "/halls" })
            {
                using var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, path, new { name = "CSRF", branchId = factory.OwnBranchId }, token);
                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            }
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    [InlineData(UserRole.Administrator)]
    public async Task Hall_creation_validation_preserves_field_errors_and_never_writes(UserRole role)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(role);
        using (client)
        {
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                (await db.Branches.SingleAsync(x => x.Id == factory.OwnBranchId)).IsArchived = true;
                await db.SaveChangesAsync();
            }
            var before = await SnapshotAsync(factory);
            var parents = role == UserRole.Administrator
                ? new Guid?[] { factory.OwnBranchId }
                : [null, Guid.Empty, Guid.NewGuid(), factory.OwnBranchId];
            foreach (var branchId in parents)
            {
                using var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/halls", new { branchId, name = "" }, token);
                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
                var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
                Assert.True(errors.TryGetProperty("branchId", out _));
                Assert.True(errors.TryGetProperty("name", out _));
            }
            if (role != UserRole.Administrator)
            {
                using var invalidBranch = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/branches", new { name = "" }, token);
                Assert.Equal(HttpStatusCode.BadRequest, invalidBranch.StatusCode);
                Assert.True((await invalidBranch.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").TryGetProperty("name", out _));
            }
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    [Fact]
    public async Task Shared_reads_include_foreign_and_archived_dictionaries_without_mutation_rights()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            (await db.Branches.SingleAsync(x => x.Id == factory.ForeignBranchId)).IsArchived = true;
            (await db.Halls.SingleAsync(x => x.Id == factory.OwnHallId)).IsArchived = true;
            await db.SaveChangesAsync();
        }
        var (client, _) = await factory.LoginAsync(UserRole.Administrator);
        using (client)
        {
            var branches = await client.GetFromJsonAsync<JsonElement>("/branches");
            Assert.Equal(factory.OwnBranchId, Assert.Single(branches.EnumerateArray()).GetProperty("id").GetGuid());
            var allBranches = await client.GetFromJsonAsync<JsonElement>("/branches?includeArchived=true");
            Assert.Equal(2, allBranches.GetArrayLength());
            var halls = await client.GetFromJsonAsync<JsonElement>("/halls");
            Assert.Equal(factory.ForeignHallId, Assert.Single(halls.EnumerateArray()).GetProperty("id").GetGuid());
            var allHalls = await client.GetFromJsonAsync<JsonElement>("/halls?includeArchived=true");
            Assert.Equal(2, allHalls.GetArrayLength());
            var filtered = await client.GetFromJsonAsync<JsonElement>($"/halls?branchId={factory.ForeignBranchId}&includeArchived=true");
            Assert.Equal(factory.ForeignHallId, Assert.Single(filtered.EnumerateArray()).GetProperty("id").GetGuid());
            var hall = await client.GetFromJsonAsync<JsonElement>($"/halls/{factory.ForeignHallId}");
            Assert.Equal("Foreign branch", hall.GetProperty("branchName").GetString());
            Assert.Equal(0, hall.GetProperty("groupCount").GetInt32());
        }
    }

    [Fact]
    public async Task Administrator_own_nonexistent_parent_is_validation_failure()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (client, token) = await factory.LoginAsync(UserRole.Administrator);
        var missingOwnBranch = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            // InMemory deliberately permits this otherwise FK-protected condition.
            (await db.Users.SingleAsync(x => x.Role == UserRole.Administrator)).BranchId = missingOwnBranch;
            await db.SaveChangesAsync();
        }
        using (client)
        {
            var before = await SnapshotAsync(factory);
            using var response = await BranchSettingsAppFactory.SendAsync(client, HttpMethod.Post, "/halls", new { branchId = missingOwnBranch, name = "Hall" }, token);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.True((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").TryGetProperty("branchId", out _));
            Assert.Equal(before, await SnapshotAsync(factory));
        }
    }

    private static void AssertActions(JsonElement session, string[] expected) =>
        Assert.Equal(expected, session.GetProperty("user").GetProperty("branchSettingsActions").EnumerateArray().Select(x => x.GetString()).ToArray());

    internal static async Task AssertScopeDeniedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(403, problem.GetProperty("status").GetInt32());
        Assert.Equal("/problems/branch-scope-forbidden", problem.GetProperty("type").GetString());
        Assert.Equal("branch_scope_forbidden", problem.GetProperty("code").GetString());
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    private static Task<HttpResponseMessage> MutateAsync(BranchSettingsAppFactory factory, HttpClient client, string token, string operation, bool foreign = false, bool missing = false)
    {
        var branchId = missing ? Guid.NewGuid() : foreign ? factory.ForeignBranchId : factory.OwnBranchId;
        var hallId = missing ? Guid.NewGuid() : foreign ? factory.ForeignHallId : factory.OwnHallId;
        var parts = operation.Split('-');
        var resource = parts[0] == "branch" ? "branches" : "halls";
        var method = parts[1] == "create" ? HttpMethod.Post : parts[1] == "delete" ? HttpMethod.Delete : HttpMethod.Put;
        var path = parts[1] == "create" ? $"/{resource}" : $"/{resource}/{(resource == "branches" ? branchId : hallId)}";
        if (parts[1] is "archive" or "restore") path += $"/{parts[1]}";
        return BranchSettingsAppFactory.SendAsync(client, method, path, new { name = "Changed", branchId }, token);
    }

    private static async Task<string> SnapshotAsync(BranchSettingsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        return JsonSerializer.Serialize(new
        {
            branches = await db.Branches.AsNoTracking().OrderBy(x => x.Id).Select(x => new { x.Id, x.Name, x.IsArchived, x.UpdatedAt }).ToArrayAsync(),
            halls = await db.Halls.AsNoTracking().OrderBy(x => x.Id).Select(x => new { x.Id, x.BranchId, x.Name, x.IsArchived, x.UpdatedAt }).ToArrayAsync(),
            audits = await db.AuditLogs.AsNoTracking().OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync()
        });
    }
}
