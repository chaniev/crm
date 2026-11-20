using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class ClientFullNameSearchPostgreSqlTests
{
    [Fact]
    public async Task Full_name_search_matches_each_word_before_pagination()
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("TASK204_BROWSER_HOST_FILE"))) factory.UseKestrel(0);
        await factory.SeedAsync();
        var target = Environment.GetEnvironmentVariable("TASK204_BROWSER_HOST_FILE");
        var expected = await SeedAsync(factory);
        if (!string.IsNullOrEmpty(target))
        {
            var address = factory.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            await File.WriteAllTextAsync(target, JsonSerializer.Serialize(new { address }));
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(15));
            while (!File.Exists(target + ".stop")) await Task.Delay(200, timeout.Token);
        }
        foreach (var role in new[] { UserRole.HeadCoach, UserRole.SuperAdministrator, UserRole.Administrator, UserRole.Coach })
        {
            var (http, _) = await factory.LoginAsync(role);
            using (http)
            {
                foreach (var parameter in new[] { "query", "search", "fullName" })
                {
                    foreach (var text in new[] { "Алексеев", "Алексеев Алексей", "Алексеев Алексей Дмитриевич", "  аЛеКсЕеВ   аЛеКсЕй  " })
                    {
                        var result = await http.GetFromJsonAsync<JsonElement>($"/clients?{parameter}={Uri.EscapeDataString(text)}&page=1&pageSize=1");
                        Assert.Equal(1, result.GetProperty("totalCount").GetInt32());
                        Assert.Equal(expected, result.GetProperty("items")[0].GetProperty("id").GetGuid());
                    }
                }
                foreach (var parameter in new[] { "query", "search" })
                {
                    var result = await http.GetFromJsonAsync<JsonElement>($"/clients?{parameter}={Uri.EscapeDataString("+7 (999) 000-00-01")}");
                    Assert.Equal(role == UserRole.Coach ? 0 : 1, result.GetProperty("totalCount").GetInt32());
                }
                using var phone = await http.GetAsync("/clients?phone=79990000001");
                Assert.Equal(role == UserRole.Coach ? System.Net.HttpStatusCode.Forbidden : System.Net.HttpStatusCode.OK, phone.StatusCode);
                var mismatch = await http.GetFromJsonAsync<JsonElement>("/clients?query=" + Uri.EscapeDataString("Алексеев Несуществующий"));
                Assert.Equal(0, mismatch.GetProperty("totalCount").GetInt32());
                var priority = await http.GetFromJsonAsync<JsonElement>("/clients?query=" + Uri.EscapeDataString("Алексеев Алексей") + "&search=missing");
                Assert.Equal(1, priority.GetProperty("totalCount").GetInt32());
            }
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach, 4)]
    [InlineData(UserRole.SuperAdministrator, 4)]
    [InlineData(UserRole.Administrator, 3)]
    [InlineData(UserRole.Coach, 1)]
    public async Task Matching_and_counts_respect_scope_before_pagination(UserRole role, int surnameCount)
    {
        await using var postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var factory = new BranchSettingsAppFactory(postgres.GetConnectionString());
        await factory.SeedAsync();
        var expected = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            foreach (var (first, middle, branch) in new[] {
                ("Алексей", "Александрович", factory.OwnBranchId),
                ("Андрей", "Дмитриевич", factory.OwnBranchId),
                ("Алексей", "Дмитриевич", factory.ForeignBranchId) })
            {
                db.Clients.Add(new Client
                {
                    Id = Guid.NewGuid(),
                    BranchId = branch,
                    LastName = "Алексеев",
                    FirstName = first,
                    MiddleName = middle,
                    Phone = "+79990000002",
                    Status = ClientStatus.Active,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
            }
            await db.SaveChangesAsync();
        }
        var (http, _) = await factory.LoginAsync(role);
        using (http)
        {
            foreach (var parameter in new[] { "query", "search", "fullName" })
            {
                foreach (var (name, count) in new[] { ("Алексеев", surnameCount),
                    ("Алексеев Алексей", role == UserRole.Coach ? 1 : Math.Max(0, surnameCount - 1)),
                    ("Алексеев Алексей Дмитриевич", role == UserRole.Coach ? 1 : Math.Max(0, surnameCount - 2)) })
                {
                    var ids = new List<Guid>();
                    for (var page = 1; page <= Math.Max(1, count); page++)
                    {
                        var result = await http.GetFromJsonAsync<JsonElement>($"/clients?{parameter}={Uri.EscapeDataString(name)}&status=Active&page={page}&pageSize=1");
                        Assert.Equal(count, result.GetProperty("totalCount").GetInt32());
                        Assert.Equal(count, result.GetProperty("activeCount").GetInt32());
                        ids.AddRange(result.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()));
                    }
                    Assert.Equal(count, ids.Distinct().Count());
                    if (count > 0) Assert.Contains(expected, ids);
                }
            }
        }
    }

    private static async Task<Guid> SeedAsync(BranchSettingsAppFactory factory)
    {
        var groupId = await ClientImportPostgreSqlTests.SeedGroupAsync(factory);
        var expected = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.Clients.Add(new Client
            {
                Id = expected,
                BranchId = factory.OwnBranchId,
                LastName = "Алексеев",
                FirstName = "Алексей",
                MiddleName = "Дмитриевич",
                Phone = "+79990000001",
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            var coach = await db.Users.SingleAsync(user => user.Role == UserRole.Coach);
            db.GroupTrainers.Add(new GroupTrainer { GroupId = groupId, TrainerId = coach.Id });
            db.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                TrainerId = coach.Id,
                ValidFrom = new DateOnly(2000, 1, 1),
                CreatedByUserId = coach.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });
            db.ClientGroups.Add(new ClientGroup { ClientId = expected, GroupId = groupId, BranchId = factory.OwnBranchId });
            await db.SaveChangesAsync();
        }
        return expected;
    }
}
