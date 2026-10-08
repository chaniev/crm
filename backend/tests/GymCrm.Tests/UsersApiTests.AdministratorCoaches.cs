using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public partial class UsersApiTests
{
    [Fact]
    public async Task Administrators_in_two_branches_share_all_coaches_and_global_account_changes()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        Guid secondAdministratorId;
        Guid[] coachIds;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var now = DateTimeOffset.UtcNow;
            var secondAdministrator = CreateUser("second-admin", "Другой администратор", UserRole.Administrator, seeded.SharedPassword, now, hasher);
            secondAdministrator.BranchId = seeded.SecondBranchId;
            secondAdministratorId = secondAdministrator.Id;
            db.Users.Add(secondAdministrator);
            var coaches = new[] { "own", "foreign", "shared", "inactive" }
                .Select(name => CreateUser(name, $"Тренер {name}", UserRole.Coach, seeded.SharedPassword, now, hasher))
                .ToArray();
            coaches[3].IsActive = false;
            db.Users.AddRange(coaches);
            var groups = new[] { seeded.BranchId, seeded.SecondBranchId }.Select(branchId => new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = branchId,
                Name = "Группа",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            }).ToArray();
            db.TrainingGroups.AddRange(groups);
            db.GroupTrainers.AddRange(
                new GroupTrainer { GroupId = groups[0].Id, TrainerId = coaches[0].Id },
                new GroupTrainer { GroupId = groups[1].Id, TrainerId = coaches[1].Id },
                new GroupTrainer { GroupId = groups[0].Id, TrainerId = coaches[2].Id },
                new GroupTrainer { GroupId = groups[1].Id, TrainerId = coaches[2].Id });
            await db.SaveChangesAsync();
            coachIds = [seeded.CoachId, .. coaches.Select(coach => coach.Id)];
        }

        using var first = factory.CreateClient();
        using var second = factory.CreateClient();
        var firstSession = await LoginAsync(first, seeded.AdministratorLogin, seeded.SharedPassword);
        var secondSession = await LoginAsync(second, "second-admin", seeded.SharedPassword);
        foreach (var client in new[] { first, second })
        {
            using var list = await client.GetAsync("/coaches");
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
            var payload = await ReadJsonElementAsync(list);
            Assert.Equal(coachIds.Order(), payload.GetProperty("items").EnumerateArray().Select(item => GetGuidFromProperty(item, "id")).Order());
            foreach (var coachId in coachIds)
            {
                using var detail = await client.GetAsync($"/coaches/{coachId}");
                Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
                var coach = await ReadJsonElementAsync(detail);
                Assert.Equal(JsonValueKind.Null, coach.GetProperty("branchId").ValueKind);
                Assert.Equal(new[] { "Coach" }, coach.GetProperty("roleOptions").EnumerateArray().Select(item => item.GetString()));
            }
        }

        using var create = await PostJsonAsync(first, "/coaches",
            new UserCreateRequest("Новый тренер без групп", "shared-new", seeded.SharedPassword, "Coach", false, true), firstSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await ReadJsonElementAsync(create);
        var createdId = GetGuidFromProperty(created, "id");
        Assert.False(created.TryGetProperty("password", out _));
        Assert.False(created.TryGetProperty("passwordHash", out _));
        Assert.DoesNotContain(seeded.SharedPassword, created.GetRawText());
        foreach (var isActive in new[] { false, true })
        {
            using var update = await PutJsonAsync(second, $"/coaches/{createdId}",
                new UserUpdateRequest("Общее новое имя", "shared-new", "Coach", true, isActive, "Telegram", "187123456"), secondSession.CsrfToken);
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);
            using var read = await first.GetAsync($"/coaches/{createdId}");
            var coach = await ReadJsonElementAsync(read);
            Assert.Equal("Общее новое имя", coach.GetProperty("fullName").GetString());
            Assert.Equal("187123456", coach.GetProperty("messengerPlatformUserId").GetString());
            Assert.Equal(isActive, coach.GetProperty("isActive").GetBoolean());
        }

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await verificationDb.GroupTrainers.AnyAsync(assignment => assignment.TrainerId == createdId));
        var audits = await verificationDb.AuditLogs.Where(log => log.EntityType == "User" && log.EntityId == createdId.ToString()).OrderBy(log => log.CreatedAt).ToArrayAsync();
        Assert.Equal(new[] { seeded.AdministratorId, secondAdministratorId, secondAdministratorId }, audits.Select(log => log.UserId));
        Assert.All(audits, audit =>
        {
            AssertAuditState(audit.NewValueJson, "Coach", null);
            AssertNoPasswordInAuditState(audit.NewValueJson);
            AssertNoPasswordInAuditState(audit.OldValueJson);
        });
    }

    [Theory]
    [InlineData("HeadCoach", null, "staff_role_transition_forbidden")]
    [InlineData("SuperAdministrator", null, "staff_role_transition_forbidden")]
    [InlineData("Administrator", null, "staff_role_transition_forbidden")]
    [InlineData("unknown", "role", null)]
    [InlineData("2", "role", null)]
    [InlineData("99", "role", null)]
    [InlineData(null, "role", null)]
    [InlineData("Coach", "branchId", null)]
    [InlineData("Coach", "login", null)]
    [InlineData("Coach", "messengerPlatformUserId", null)]
    public async Task Administrator_coach_writes_reject_invalid_role_branch_and_identity_without_state_or_audit_changes(
        string? role, string? errorField, string? denial)
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient();
        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var owner = await db.Users.SingleAsync(user => user.Id == seeded.HeadCoachId);
            owner.MessengerPlatform = MessengerPlatform.Telegram;
            owner.MessengerPlatformUserId = "187123456";
            await db.SaveChangesAsync();
        }
        string stateBefore;
        int auditCount;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            stateBefore = JsonSerializer.Serialize(await db.Users.OrderBy(user => user.Login).ToArrayAsync());
            auditCount = await db.AuditLogs.CountAsync();
        }
        foreach (var isCreate in new[] { true, false })
        {
            var payload = new
            {
                fullName = "Запрещённое изменение",
                login = errorField == "login" ? seeded.CoachLogin.ToUpperInvariant() : isCreate ? "denied-create" : seeded.CoachLogin,
                password = "test-password",
                role,
                mustChangePassword = false,
                isActive = true,
                branchId = errorField == "branchId" ? seeded.BranchId : (Guid?)null,
                messengerPlatform = errorField == "messengerPlatformUserId" ? "Telegram" : null,
                messengerPlatformUserId = errorField == "messengerPlatformUserId" ? "187123456" : null
            };
            using var response = isCreate
                ? await PostJsonAsync(client, "/coaches", payload, session.CsrfToken)
                : await PutJsonAsync(client, $"/coaches/{seeded.CoachId}", payload, session.CsrfToken);
            Assert.Equal(denial is null ? HttpStatusCode.BadRequest : HttpStatusCode.Forbidden, response.StatusCode);
            if (denial is not null)
            {
                Assert.Equal(denial, (await ReadJsonElementAsync(response)).GetProperty("code").GetString());
            }
            else
            {
                AssertHasError(await ReadValidationErrorsAsync(response), errorField!);
            }
        }
        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(stateBefore, JsonSerializer.Serialize(await verificationDb.Users.OrderBy(user => user.Login).ToArrayAsync()));
        Assert.Equal(auditCount, await verificationDb.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task Administrator_cannot_discover_or_mutate_other_staff_families_or_attendance_grants()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient();
        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        foreach (var id in new[] { seeded.AdministratorId, seeded.HeadCoachId, seeded.SuperAdministratorId, Guid.NewGuid() })
        {
            using var getCoach = await client.GetAsync($"/coaches/{id}");
            using var updateCoach = await PutJsonAsync(client, $"/coaches/{id}", new { }, session.CsrfToken);
            foreach (var response in new[] { getCoach, updateCoach })
            {
                Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
                Assert.Equal("staff_not_found", (await ReadJsonElementAsync(response)).GetProperty("code").GetString());
            }
            using var getAdministrator = await client.GetAsync($"/settings/administrators/{id}");
            using var updateAdministrator = await PutJsonAsync(client, $"/settings/administrators/{id}", new { }, session.CsrfToken);
            using var grants = await client.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups");
            using var updateGrants = await PutJsonAsync(client, $"/settings/administrators/{seeded.AdministratorId}/attendance-groups", new { groupIds = Array.Empty<Guid>(), expectedGroupIds = Array.Empty<Guid>() }, session.CsrfToken);
            foreach (var response in new[] { getAdministrator, updateAdministrator, grants, updateGrants })
            {
                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
                Assert.Equal("staff_management_forbidden", (await ReadJsonElementAsync(response)).GetProperty("code").GetString());
            }
        }
        using var create = await PostJsonAsync(client, "/settings/administrators", new { }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal("staff_management_forbidden", (await ReadJsonElementAsync(create)).GetProperty("code").GetString());
        using var noCsrf = await client.PostAsJsonAsync("/coaches", new { });
        Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);
        using var anonymous = factory.CreateClient();
        using var anonymousRead = await anonymous.GetAsync("/coaches");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousRead.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await db.AuditLogs.AnyAsync(log => log.EntityType == "User"));
        Assert.Equal(6, await db.Users.CountAsync());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Administrator_edit_or_deactivate_revokes_coach_cookie_and_reactivation_does_not_restore_it(bool deactivate)
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var administrator = factory.CreateClient();
        using var coach = factory.CreateClient();
        var session = await LoginAsync(administrator, seeded.AdministratorLogin, seeded.SharedPassword);
        await LoginAsync(coach, seeded.CoachLogin, seeded.SharedPassword);
        using var update = await PutJsonAsync(administrator, $"/coaches/{seeded.CoachId}",
            new UserUpdateRequest("Новое имя тренера", seeded.CoachLogin, "Coach", false, !deactivate), session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        using var stale = await coach.GetAsync("/auth/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);
        using var reactivate = await PutJsonAsync(administrator, $"/coaches/{seeded.CoachId}",
            new UserUpdateRequest("Новое имя тренера", seeded.CoachLogin, "Coach", false, true), session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);
        Assert.False((await GetSessionAsync(coach)).IsAuthenticated);
        Assert.True((await LoginAsync(coach, seeded.CoachLogin, seeded.SharedPassword)).IsAuthenticated);
    }
}
