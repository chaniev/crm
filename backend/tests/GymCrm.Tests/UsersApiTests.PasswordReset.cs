using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public partial class UsersApiTests
{
    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Global_roles_can_reset_both_families_and_stale_edits_keep_the_recovery_requirement(
        bool superAdministrator, bool administratorTarget)
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient();
        var actorLogin = superAdministrator ? seeded.SuperAdministratorLogin : seeded.HeadCoachLogin;
        var actorId = superAdministrator ? seeded.SuperAdministratorId : seeded.HeadCoachId;
        var targetId = administratorTarget ? seeded.AdministratorId : seeded.CoachId;
        var targetLogin = administratorTarget ? seeded.AdministratorLogin : seeded.CoachLogin;
        var family = administratorTarget ? "/settings/administrators" : "/coaches";
        var path = $"{family}/{targetId}";
        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        using var list = await client.GetAsync(family);
        var item = (await ReadJsonElementAsync(list)).GetProperty("items").EnumerateArray()
            .Single(user => GetGuidFromProperty(user, "id") == targetId);
        Assert.True(HasPasswordResetAction(item));
        using var detail = await client.GetAsync(path);
        var before = await ReadJsonElementAsync(detail);
        Assert.True(HasPasswordResetAction(before));
        Assert.False(before.GetProperty("passwordResetPending").GetBoolean());

        // A first reset may match the current personal password without disclosing that match.
        foreach (var temporaryPassword in new[] { seeded.SharedPassword, "  second temporary  " })
        {
            using var reset = await PostJsonAsync(client, $"{path}/reset-password", new { temporaryPassword }, session.CsrfToken);
            Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
            Assert.Empty(await reset.Content.ReadAsByteArrayAsync());
            using var duplicate = await PostJsonAsync(client, $"{path}/reset-password", new { temporaryPassword }, session.CsrfToken);
            Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
            AssertHasError(await ReadValidationErrorsAsync(duplicate), "temporaryPassword");
            Assert.DoesNotContain(temporaryPassword, await duplicate.Content.ReadAsStringAsync());
        }

        using var update = await PutJsonAsync(client, path, new
        {
            fullName = "Сохранённое имя",
            login = targetLogin,
            role = administratorTarget ? "Administrator" : "Coach",
            mustChangePassword = false,
            isActive = true,
            branchId = administratorTarget ? seeded.BranchId : (Guid?)null
        }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var saved = await ReadJsonElementAsync(update);
        Assert.True(HasPasswordResetAction(saved));
        Assert.True(saved.GetProperty("passwordResetPending").GetBoolean());
        Assert.True(saved.GetProperty("mustChangePassword").GetBoolean());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var target = await db.Users.SingleAsync(u => u.Id == targetId);
        Assert.True(scope.ServiceProvider.GetRequiredService<IPasswordHashService>().VerifyPassword(target, "  second temporary  "));
        var audits = await db.AuditLogs.Where(log => log.ActionType == "PasswordReset").ToListAsync();
        Assert.Equal(2, audits.Count);
        Assert.All(audits, log =>
        {
            Assert.Equal(actorId, log.UserId);
            Assert.Equal(targetId.ToString(), log.EntityId);
            Assert.NotEqual(default, log.CreatedAt);
            Assert.Null(log.OldValueJson);
            Assert.Null(log.NewValueJson);
            Assert.DoesNotContain(seeded.SharedPassword, log.Description);
            Assert.DoesNotContain("second temporary", log.Description);
            Assert.DoesNotContain(target.PasswordHash, log.Description);
        });
    }

    [Fact]
    public async Task Administrator_reset_requires_a_current_primary_assignment_in_the_actors_branch_at_write_time()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        using var client = factory.CreateClient();
        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        var path = $"/coaches/{seeded.CoachId}";
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var today = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today;
        var now = DateTimeOffset.UtcNow;
        var ownGroup = new TrainingGroup { Id = Guid.NewGuid(), BranchId = seeded.BranchId, Name = "Основная", IsActive = true, CreatedAt = now, UpdatedAt = now };
        var foreignGroup = new TrainingGroup { Id = Guid.NewGuid(), BranchId = seeded.SecondBranchId, Name = "Другая", IsActive = true, CreatedAt = now, UpdatedAt = now };
        db.TrainingGroups.AddRange(ownGroup, foreignGroup);
        GroupTrainerAssignment Period(Guid groupId, DateOnly from, DateOnly? to) => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = seeded.CoachId,
            ValidFrom = from,
            ValidTo = to,
            CreatedAt = now,
            CreatedByUserId = seeded.HeadCoachId
        };
        db.GroupTrainerAssignments.AddRange(
            Period(foreignGroup.Id, today, null),
            Period(ownGroup.Id, today.AddDays(-3), today.AddDays(-1)),
            Period(ownGroup.Id, today.AddDays(1), null));
        db.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = ownGroup.Id,
            SubstituteTrainerId = seeded.CoachId,
            StartsOn = today,
            EndsOn = today,
            CreatedByUserId = seeded.HeadCoachId,
            CreatedAt = now,
            UpdatedAt = now
        });
        var substituteLesson = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = ownGroup.Id,
            LessonDate = today,
            DurationMinutes = 60,
            Hall = new Hall { Id = Guid.NewGuid(), BranchId = seeded.BranchId, Name = "Зал", CreatedAt = now, UpdatedAt = now },
            CreatedAt = now,
            UpdatedAt = now
        };
        db.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            LessonOccurrence = substituteLesson,
            SubstituteTrainerId = seeded.CoachId,
            ReplacedTrainerId = seeded.HeadCoachId,
            CreatedByUserId = seeded.HeadCoachId,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
        {
            AdministratorId = seeded.AdministratorId,
            BranchId = seeded.SecondBranchId,
            GroupId = foreignGroup.Id,
            GrantedByUserId = seeded.HeadCoachId,
            GrantedAt = now
        });
        // A snapshot row alone is never a primary assignment for the current business date.
        db.GroupTrainers.Add(new GroupTrainer { GroupId = ownGroup.Id, TrainerId = seeded.CoachId });
        await db.SaveChangesAsync();

        using var noAssignment = await client.GetAsync(path);
        Assert.False(HasPasswordResetAction(await ReadJsonElementAsync(noAssignment)));
        var currentPeriod = Period(ownGroup.Id, today, today);
        db.GroupTrainerAssignments.Add(currentPeriod);
        await db.SaveChangesAsync();
        using var list = await client.GetAsync("/coaches");
        var item = (await ReadJsonElementAsync(list)).GetProperty("items").EnumerateArray().Single(u => GetGuidFromProperty(u, "id") == seeded.CoachId);
        Assert.True(HasPasswordResetAction(item));
        var target = await db.Users.SingleAsync(u => u.Id == seeded.CoachId);
        target.IsActive = false;
        await db.SaveChangesAsync();
        using var success = await PostJsonAsync(client, $"{path}/reset-password", new { temporaryPassword = "first" }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.NoContent, success.StatusCode);
        await db.Entry(target).ReloadAsync();
        Assert.False(target.IsActive);
        var before = (target.PasswordHash, target.MustChangePassword, target.PasswordResetPending, target.CredentialVersion, target.UpdatedAt);
        var admin = await db.Users.SingleAsync(u => u.Id == seeded.AdministratorId);
        admin.BranchId = null;
        await db.SaveChangesAsync();
        using var noBranchDetail = await client.GetAsync(path);
        Assert.False(HasPasswordResetAction(await ReadJsonElementAsync(noBranchDetail)));
        using var noBranchReset = await PostJsonAsync(client, $"{path}/reset-password", new { temporaryPassword = "second" }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, noBranchReset.StatusCode);
        Assert.Equal("branch_scope_forbidden", (await ReadJsonElementAsync(noBranchReset)).GetProperty("code").GetString());
        admin.BranchId = seeded.BranchId;
        db.GroupTrainerAssignments.Remove(currentPeriod);
        await db.SaveChangesAsync();
        using var stale = await PostJsonAsync(client, $"{path}/reset-password", new { temporaryPassword = "second" }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, stale.StatusCode);
        Assert.Equal("branch_scope_forbidden", (await ReadJsonElementAsync(stale)).GetProperty("code").GetString());
        await db.Entry(target).ReloadAsync();
        Assert.Equal(before, (target.PasswordHash, target.MustChangePassword, target.PasswordResetPending, target.CredentialVersion, target.UpdatedAt));
        Assert.Single(await db.AuditLogs.Where(log => log.ActionType == "PasswordReset").ToArrayAsync());
    }

    [Theory]
    [InlineData("coach", "coaches", "unknown", HttpStatusCode.Forbidden, "staff_management_forbidden")]
    [InlineData("administrator", "settings/administrators", "self", HttpStatusCode.Forbidden, "staff_management_forbidden")]
    [InlineData("administrator", "coaches", "coach", HttpStatusCode.Forbidden, "branch_scope_forbidden")]
    [InlineData("head", "coaches", "self", HttpStatusCode.NotFound, "staff_not_found")]
    [InlineData("head", "coaches", "administrator", HttpStatusCode.NotFound, "staff_not_found")]
    [InlineData("super", "settings/administrators", "self", HttpStatusCode.Forbidden, "staff_target_forbidden")]
    [InlineData("head", "settings/administrators", "super", HttpStatusCode.Forbidden, "staff_target_forbidden")]
    [InlineData("head", "settings/administrators", "coach", HttpStatusCode.NotFound, "staff_not_found")]
    [InlineData("head", "coaches", "unknown", HttpStatusCode.NotFound, "staff_not_found")]
    public async Task Reset_denials_do_not_disclose_other_families_or_modify_users(
        string actor, string family, string target, HttpStatusCode status, string code)
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        var (actorLogin, actorId) = actor switch
        {
            "coach" => (seeded.CoachLogin, seeded.CoachId),
            "administrator" => (seeded.AdministratorLogin, seeded.AdministratorId),
            "super" => (seeded.SuperAdministratorLogin, seeded.SuperAdministratorId),
            _ => (seeded.HeadCoachLogin, seeded.HeadCoachId)
        };
        var targetId = target switch
        {
            "self" => actorId,
            "coach" => seeded.CoachId,
            "administrator" => seeded.AdministratorId,
            "super" => seeded.SuperAdministratorId,
            _ => Guid.NewGuid()
        };
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        using var client = factory.CreateClient();
        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        var before = await db.Users.AsNoTracking().OrderBy(u => u.Login).ToListAsync();
        using var denied = await PostJsonAsync(client, $"/{family}/{targetId}/reset-password",
            new { temporaryPassword = "synthetic" }, session.CsrfToken);
        Assert.Equal(status, denied.StatusCode);
        Assert.Equal(code, (await ReadJsonElementAsync(denied)).GetProperty("code").GetString());
        var after = await db.Users.AsNoTracking().OrderBy(u => u.Login).ToListAsync();
        Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(after));
        Assert.False(await db.AuditLogs.AnyAsync(log => log.ActionType == "PasswordReset"));
    }

    [Fact]
    public async Task Reset_rejects_anonymous_missing_csrf_and_blank_values_without_writing_credentials()
    {
        await using var factory = new UsersAppFactory();
        var seeded = await SeedUsersDataAsync(factory);
        var path = $"/coaches/{seeded.CoachId}/reset-password";
        using var client = factory.CreateClient();
        using var anonymous = await client.PostAsJsonAsync(path, new { temporaryPassword = "synthetic" });
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        using var noCsrf = await client.PostAsJsonAsync(path, new { temporaryPassword = "synthetic" });
        Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);
        foreach (object payload in new object[] { new { }, new { temporaryPassword = "" }, new { temporaryPassword = "  " } })
        {
            using var invalid = await PostJsonAsync(client, path, payload, session.CsrfToken);
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            AssertHasError(await ReadValidationErrorsAsync(invalid), "temporaryPassword");
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var coach = await db.Users.SingleAsync(u => u.Id == seeded.CoachId);
        Assert.True(scope.ServiceProvider.GetRequiredService<IPasswordHashService>().VerifyPassword(coach, seeded.SharedPassword));
        Assert.Null(coach.CredentialVersion);
        Assert.False(coach.PasswordResetPending);
        Assert.False(coach.MustChangePassword);
        Assert.False(await db.AuditLogs.AnyAsync(log => log.ActionType == "PasswordReset"));
    }

    private static bool HasPasswordResetAction(JsonElement user)
        => user.GetProperty("allowedActions").EnumerateArray().Any(action => action.GetString() == "ResetPassword");
}
