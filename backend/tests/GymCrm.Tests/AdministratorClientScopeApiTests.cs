using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public class AdministratorClientScopeApiTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Attendance_grant_does_not_authorize_foreign_client_write_or_bot_replay(bool bot)
    {
        await using var factory = new BranchSettingsAppFactory(botServiceToken: "task191-test-token");
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var groupId = Guid.NewGuid();
        var lessonId = Guid.NewGuid();
        DateOnly today;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            today = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today;
            var actor = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
            actor.MessengerPlatform = MessengerPlatform.Telegram;
            actor.MessengerPlatformUserId = "task191-administrator";
            var type = new GroupType { Id = Guid.NewGuid(), Name = "Attendance scope" };
            db.GroupTypes.Add(type);
            db.TrainingGroups.Add(new TrainingGroup
            {
                Id = groupId,
                BranchId = factory.OwnBranchId,
                HallId = factory.OwnHallId,
                GroupTypeId = type.Id,
                Name = "Granted group",
                DurationMinutes = 60,
                Weekdays = [1, 2, 3, 4, 5, 6, 7],
                TrainingStartTime = new TimeOnly(12, 0)
            });
            db.ClientGroups.AddRange(new ClientGroup { ClientId = own.Id, GroupId = groupId, BranchId = factory.OwnBranchId },
                new ClientGroup { ClientId = foreign.Id, GroupId = groupId, BranchId = factory.OwnBranchId });
            db.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
            {
                AdministratorId = actor.Id,
                GroupId = groupId,
                BranchId = factory.OwnBranchId,
                GrantedByUserId = actor.Id
            });
            db.LessonOccurrences.Add(new LessonOccurrence
            {
                Id = lessonId,
                GroupId = groupId,
                HallId = factory.OwnHallId,
                LessonDate = today,
                StartTime = new TimeOnly(12, 0),
                DurationMinutes = 60,
                SourceKind = LessonOccurrenceSourceKind.OneOff
            });
            await db.SaveChangesAsync();
        }
        var (http, token) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            if (bot) http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "task191-test-token");
            var prefix = bot ? "/internal/bot" : "";
            var path = $"{prefix}/attendance/lessons/{lessonId}?lessonDate={today:yyyy-MM-dd}";
            var identityQuery = bot ? "&platform=Telegram&platformUserId=task191-administrator" : "";
            var roster = await http.GetFromJsonAsync<JsonElement>($"{prefix}/attendance/lessons/{lessonId}/clients?lessonDate={today:yyyy-MM-dd}{identityQuery}");
            Assert.Equal(own.Id, Assert.Single(roster.GetProperty("clients").EnumerateArray()).GetProperty("id").GetGuid());
            async Task<HttpResponseMessage> Save(Guid clientId, string key)
            {
                http.DefaultRequestHeaders.Remove("Idempotency-Key");
                http.DefaultRequestHeaders.Add("Idempotency-Key", key);
                return await BranchSettingsAppFactory.SendAsync(http, HttpMethod.Post, path,
                    new
                    {
                        platform = "Telegram",
                        platformUserId = "task191-administrator",
                        trainingDate = today.ToString("yyyy-MM-dd"),
                        attendanceMarks = new[] { new { clientId, state = "Present", isPresent = true } }
                    }, token);
            }
            using var denied = await Save(foreign.Id, "task191-foreign-attendance");
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            using var allowed = await Save(own.Id, "task191-own-attendance");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                (await db.Clients.SingleAsync(client => client.Id == own.Id)).BranchId = factory.ForeignBranchId;
                await db.SaveChangesAsync();
            }
            using var replay = await Save(own.Id, "task191-own-attendance");
            Assert.Equal(HttpStatusCode.NotFound, replay.StatusCode);
        }
        using var verification = factory.Services.CreateScope();
        var persisted = verification.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(own.Id, Assert.Single(await persisted.Attendance.ToArrayAsync()).ClientId);
        Assert.False(await persisted.BotIdempotencyRecords.AnyAsync(record => record.IdempotencyKey == "task191-foreign-attendance"));
    }

    [Theory]
    [InlineData(UserRole.Administrator, 0)]
    [InlineData(UserRole.HeadCoach, 1)]
    public async Task Hidden_foreign_membership_still_blocks_group_deactivation_without_disclosing_details(UserRole role, int visibleBlockers)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (_, foreign) = await SeedClientsAsync(factory);
        var groupId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(user => user.Login == "HeadCoach");
            db.GroupTypes.Add(new GroupType { Id = typeId, Name = "Scope test" });
            db.TrainingGroups.Add(new TrainingGroup
            {
                Id = groupId,
                BranchId = factory.OwnBranchId,
                HallId = factory.OwnHallId,
                GroupTypeId = typeId,
                Name = "Protected group",
                DurationMinutes = 60,
                Weekdays = [1],
                TrainingStartTime = new TimeOnly(12, 0)
            });
            var sale = new ClientMembershipSale
            {
                Id = Guid.NewGuid(),
                ClientId = foreign.Id,
                BehaviorKind = MembershipBehaviorKind.SingleVisit,
                CreatedByUserId = actor.Id
            };
            var membership = new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = foreign.Id,
                SaleId = sale.Id,
                BehaviorKind = MembershipBehaviorKind.SingleVisit,
                ChangedByUserId = actor.Id
            };
            membership.TargetGroups.Add(new ClientMembershipTargetGroup
            {
                ClientMembershipId = membership.Id,
                GroupId = groupId,
                BranchId = factory.OwnBranchId,
                Position = 1
            });
            db.ClientMembershipSales.Add(sale);
            db.ClientMemberships.Add(membership);
            await db.SaveChangesAsync();
        }
        var (http, token) = await factory.LoginAsync(role);
        using (http)
        using (var response = await BranchSettingsAppFactory.SendAsync(http, HttpMethod.Put, $"/groups/{groupId}",
            new { name = "Protected group", branchId = factory.OwnBranchId, groupTypeId = typeId, isActive = false }, token))
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("group-active-memberships", problem.GetProperty("code").GetString());
            Assert.Equal(visibleBlockers, problem.GetProperty("affectedMemberships").GetArrayLength());
            if (visibleBlockers == 0) Assert.DoesNotContain(foreign.Id.ToString(), problem.ToString());
        }
        using var verification = factory.Services.CreateScope();
        Assert.True((await verification.ServiceProvider.GetRequiredService<GymCrmDbContext>().TrainingGroups.SingleAsync(group => group.Id == groupId)).IsActive);
    }

    [Fact]
    public async Task Shared_lookups_hide_foreign_counts_and_group_rosters_exclude_foreign_clients()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var ownGroupId = Guid.NewGuid();
        var foreignGroupId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var type = new GroupType { Id = Guid.NewGuid(), Name = "Scope test" };
            db.GroupTypes.Add(type);
            db.TrainingGroups.AddRange(
                new TrainingGroup { Id = ownGroupId, BranchId = factory.OwnBranchId, HallId = factory.OwnHallId, GroupTypeId = type.Id, Name = "Own group" },
                new TrainingGroup { Id = foreignGroupId, BranchId = factory.ForeignBranchId, HallId = factory.ForeignHallId, GroupTypeId = type.Id, Name = "Foreign group" });
            var administrator = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
            db.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
            {
                AdministratorId = administrator.Id,
                GroupId = ownGroupId,
                BranchId = factory.OwnBranchId,
                GrantedByUserId = administrator.Id
            });
            db.ClientGroups.AddRange(
                new ClientGroup { ClientId = own.Id, GroupId = ownGroupId, BranchId = factory.OwnBranchId },
                new ClientGroup { ClientId = foreign.Id, GroupId = ownGroupId, BranchId = factory.OwnBranchId },
                new ClientGroup { ClientId = foreign.Id, GroupId = foreignGroupId, BranchId = factory.ForeignBranchId });
            await db.SaveChangesAsync();
        }
        var (http, _) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            var branches = await http.GetFromJsonAsync<JsonElement>("/branches");
            Assert.Equal(2, branches.GetArrayLength());
            var foreignBranch = branches.EnumerateArray().Single(branch => branch.GetProperty("id").GetGuid() == factory.ForeignBranchId);
            Assert.Equal(JsonValueKind.Null, foreignBranch.GetProperty("clientCount").ValueKind);
            var directBranch = await http.GetFromJsonAsync<JsonElement>($"/branches/{factory.ForeignBranchId}");
            Assert.Equal(JsonValueKind.Null, directBranch.GetProperty("clientCount").ValueKind);
            var roster = await http.GetFromJsonAsync<JsonElement>($"/groups/{ownGroupId}/clients");
            Assert.Equal(own.Id, Assert.Single(roster.EnumerateArray()).GetProperty("id").GetGuid());
            var attendance = await http.GetFromJsonAsync<JsonElement>("/attendance/groups");
            Assert.Equal(1, Assert.Single(attendance.GetProperty("groups").EnumerateArray()).GetProperty("clientCount").GetInt32());
            var group = await http.GetFromJsonAsync<JsonElement>($"/groups/{ownGroupId}");
            Assert.Equal(1, group.GetProperty("clientCount").GetInt32());
            var lookup = await http.GetFromJsonAsync<JsonElement>("/schedule/groups");
            var groups = lookup.GetProperty("items").EnumerateArray().ToArray();
            Assert.Equal(2, groups.Length);
            Assert.Equal(JsonValueKind.Null, groups.Single(item => item.GetProperty("id").GetGuid() == foreignGroupId).GetProperty("clientCount").ValueKind);
            Assert.Equal(1, groups.Single(item => item.GetProperty("id").GetGuid() == ownGroupId).GetProperty("clientCount").GetInt32());
        }
    }

    [Theory]
    [InlineData("foreign")]
    [InlineData("missing")]
    [InlineData("empty")]
    [InlineData("null")]
    public async Task Administrator_create_requires_own_target_before_foreign_branch_validation(string target)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (http, token) = await factory.LoginAsync(UserRole.Administrator);
        Guid? branchId = target switch
        {
            "foreign" => factory.ForeignBranchId,
            "missing" => Guid.NewGuid(),
            "empty" => Guid.Empty,
            _ => null
        };
        using (http)
        using (var response = await BranchSettingsAppFactory.SendAsync(http, HttpMethod.Post, "/clients", new { branchId }, token))
        {
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("branch_scope_forbidden", problem.GetProperty("code").GetString());
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await db.Clients.ToArrayAsync());
        Assert.Empty(await db.ClientBranchAssignments.ToArrayAsync());
    }

    [Fact]
    public async Task Photo_access_uses_client_scope_and_foreign_upload_does_not_write_storage()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var (manager, managerToken) = await factory.LoginAsync(UserRole.HeadCoach);
        byte[] photo = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
        using (manager)
        {
            foreach (var client in new[] { own, foreign })
            {
                using var response = await UploadPhotoAsync(manager, managerToken, client.Id, photo);
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }
        }
        var originalFiles = Directory.GetFiles(factory.PhotoStorageRootPath).Order().ToArray();
        var (http, token) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            using var allowed = await http.GetAsync($"/clients/{own.Id}/photo");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
            Assert.Equal(photo, await allowed.Content.ReadAsByteArrayAsync());
            Assert.True(allowed.Headers.CacheControl!.Private);
            Assert.True(allowed.Headers.CacheControl.NoStore);
            using var denied = await http.GetAsync($"/clients/{foreign.Id}/photo");
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            using var upload = await UploadPhotoAsync(http, token, foreign.Id, photo);
            Assert.Equal(HttpStatusCode.NotFound, upload.StatusCode);
        }
        Assert.Equal(originalFiles, Directory.GetFiles(factory.PhotoStorageRootPath).Order().ToArray());
    }

    private static async Task<HttpResponseMessage> UploadPhotoAsync(HttpClient http, string token, Guid clientId, byte[] bytes)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{clientId}/photo");
        request.Headers.Add("X-CSRF-TOKEN", token);
        var multipart = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        multipart.Add(file, "photo", "scope.png");
        request.Content = multipart;
        return await http.SendAsync(request);
    }

    [Fact]
    public async Task Transfer_out_of_scope_returns_empty_success_and_only_matching_completed_replay_is_allowed()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, _) = await SeedClientsAsync(factory);
        var (http, token) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            foreach (var key in new[] { "task191-transfer", "task191-transfer", "task191-new-transfer" })
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{own.Id}/transfer")
                {
                    Content = JsonContent.Create(new { targetBranchId = factory.ForeignBranchId, targetGroupIds = Array.Empty<Guid>() })
                };
                request.Headers.Add("X-CSRF-TOKEN", token);
                request.Headers.Add("Idempotency-Key", key);
                using var response = await http.SendAsync(request);
                Assert.Equal(key == "task191-new-transfer" ? HttpStatusCode.NotFound : HttpStatusCode.NoContent, response.StatusCode);
                Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
            }
            using var card = await http.GetAsync($"/clients/{own.Id}");
            Assert.Equal(HttpStatusCode.NotFound, card.StatusCode);
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(factory.ForeignBranchId, (await db.Clients.SingleAsync(client => client.Id == own.Id)).BranchId);
        Assert.Single(await db.AuditLogs.Where(log => log.EntityId == own.Id.ToString()).ToArrayAsync());
        Assert.Single(await db.ClientBranchAssignments.Where(assignment => assignment.ClientId == own.Id).ToArrayAsync());
        Assert.Single(await db.ClientMembershipIdempotencyRecords.ToArrayAsync());
        Assert.Empty(await db.ClientMembershipSales.ToArrayAsync());
        Assert.Empty(await db.ClientMembershipRefunds.ToArrayAsync());
    }

    [Theory]
    [InlineData("PUT", "")]
    [InlineData("PUT", "/archive")]
    [InlineData("PUT", "/restore")]
    [InlineData("POST", "/transfer")]
    [InlineData("POST", "/membership/purchase")]
    [InlineData("POST", "/membership/renew")]
    [InlineData("POST", "/membership/correct")]
    [InlineData("POST", "/membership/targets/transfer/preview")]
    [InlineData("POST", "/membership/targets/transfer")]
    [InlineData("POST", "/membership/sales/00000000-0000-0000-0000-000000000001/refunds")]
    [InlineData("PUT", "/membership/sales/00000000-0000-0000-0000-000000000001/comment")]
    [InlineData("POST", "/membership/refunds/00000000-0000-0000-0000-000000000001/cancel")]
    [InlineData("POST", "/attention/missed-training/contacted")]
    [InlineData("GET", "/messenger/telegram")]
    [InlineData("GET", "/messenger/telegram/messages")]
    [InlineData("POST", "/messenger/telegram/link-token")]
    [InlineData("POST", "/messenger/telegram/messages")]
    [InlineData("POST", "/messenger/telegram/read")]
    public async Task Foreign_client_operations_are_hidden_before_validation_or_side_effects(string method, string suffix)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (_, foreign) = await SeedClientsAsync(factory);
        var (http, token) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            using var request = new HttpRequestMessage(new HttpMethod(method), $"/clients/{foreign.Id}{suffix}");
            request.Headers.Add("X-CSRF-TOKEN", token);
            request.Headers.Add("Idempotency-Key", "task191-foreign");
            if (method != "GET")
            {
                request.Content = JsonContent.Create(new { targetBranchId = factory.OwnBranchId, text = "Must not send" });
            }
            using var response = await http.SendAsync(request);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persisted = await db.Clients.SingleAsync(client => client.Id == foreign.Id);
        Assert.Equal(foreign.BranchId, persisted.BranchId);
        Assert.Equal(foreign.Status, persisted.Status);
        Assert.Equal(foreign.UpdatedAt, persisted.UpdatedAt);
        Assert.False(await db.AuditLogs.AnyAsync(log => log.EntityId == foreign.Id.ToString()));
        Assert.Empty(await db.ClientMembershipIdempotencyRecords.ToArrayAsync());
        Assert.Empty(await db.ClientMessengerLinkTokens.ToArrayAsync());
        Assert.Empty(await db.ClientMessengerReadStates.ToArrayAsync());
        Assert.Empty(await db.ClientMessengerMessages.ToArrayAsync());
    }

    [Fact]
    public async Task Bot_search_and_card_use_current_administrator_branch()
    {
        const string testToken = "task191-test-service-token";
        await using var factory = new BranchSettingsAppFactory(botServiceToken: testToken);
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
            actor.MessengerPlatform = MessengerPlatform.Telegram;
            actor.MessengerPlatformUserId = "task191-administrator";
            await db.SaveChangesAsync();
        }
        using var http = factory.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", testToken);
        const string identity = "platform=Telegram&platformUserId=task191-administrator";
        var list = await http.GetFromJsonAsync<JsonElement>($"/internal/bot/clients?{identity}&skip=0&take=1");
        Assert.Equal(own.Id, Assert.Single(list.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.False(list.GetProperty("hasMore").GetBoolean());
        using var denied = await http.GetAsync($"/internal/bot/clients/{foreign.Id}?{identity}");
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
            actor.BranchId = null;
            await db.SaveChangesAsync();
        }
        using var afterReassignment = await http.GetAsync($"/internal/bot/clients/{own.Id}?{identity}");
        Assert.Equal(HttpStatusCode.NotFound, afterReassignment.StatusCode);
        var emptyList = await http.GetFromJsonAsync<JsonElement>($"/internal/bot/clients?{identity}");
        Assert.Empty(emptyList.GetProperty("items").EnumerateArray());
    }

    [Theory]
    [InlineData("")]
    [InlineData("?page=1&pageSize=1")]
    [InlineData("?skip=0&take=1")]
    [InlineData("?hasGroup=false")]
    public async Task Administrator_list_scopes_rows_and_counts_before_paging(string query)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var (http, _) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            using var response = await http.GetAsync($"/clients{query}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
            Assert.Equal(1, payload.GetProperty("activeCount").GetInt32());
            Assert.Equal(0, payload.GetProperty("archivedCount").GetInt32());
            Assert.False(payload.GetProperty("hasNextPage").GetBoolean());
            Assert.Equal(own.Id, Assert.Single(payload.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
            Assert.DoesNotContain(foreign.Id.ToString(), payload.GetRawText());
            Assert.DoesNotContain(foreign.Phone!, payload.GetRawText());
        }
    }

    [Fact]
    public async Task Administrator_card_hides_foreign_client_and_rechecks_current_branch_for_same_session()
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var (http, _) = await factory.LoginAsync(UserRole.Administrator);
        using (http)
        {
            using var allowed = await http.GetAsync($"/clients/{own.Id}");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
            using var denied = await http.GetAsync($"/clients/{foreign.Id}");
            using var missing = await http.GetAsync($"/clients/{Guid.NewGuid()}");
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            Assert.Equal(missing.StatusCode, denied.StatusCode);
            Assert.Equal(await missing.Content.ReadAsStringAsync(), await denied.Content.ReadAsStringAsync());

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                var actor = await db.Users.SingleAsync(user => user.Role == UserRole.Administrator);
                actor.BranchId = null;
                await db.SaveChangesAsync();
            }
            using var afterReassignment = await http.GetAsync($"/clients/{own.Id}");
            Assert.Equal(HttpStatusCode.NotFound, afterReassignment.StatusCode);
            var list = await http.GetFromJsonAsync<JsonElement>("/clients");
            Assert.Equal(0, list.GetProperty("totalCount").GetInt32());
            Assert.Empty(list.GetProperty("items").EnumerateArray());
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    public async Task Global_roles_keep_access_to_both_branches(UserRole role)
    {
        await using var factory = new BranchSettingsAppFactory();
        await factory.SeedAsync();
        var (own, foreign) = await SeedClientsAsync(factory);
        var (http, _) = await factory.LoginAsync(role);
        using (http)
        {
            foreach (var client in new[] { own, foreign })
            {
                using var response = await http.GetAsync($"/clients/{client.Id}");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }
            var list = await http.GetFromJsonAsync<JsonElement>("/clients");
            Assert.Equal(2, list.GetProperty("totalCount").GetInt32());
        }
    }

    private static async Task<(Client Own, Client Foreign)> SeedClientsAsync(BranchSettingsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var now = DateTimeOffset.UtcNow;
        var own = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = factory.OwnBranchId,
            LastName = "Zulu own",
            FirstName = "Client",
            Phone = "+79990000001",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreign = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = factory.ForeignBranchId,
            LastName = "Alpha foreign",
            FirstName = "Client",
            Phone = "+79990000002",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Clients.AddRange(own, foreign);
        await db.SaveChangesAsync();
        return (own, foreign);
    }
}
