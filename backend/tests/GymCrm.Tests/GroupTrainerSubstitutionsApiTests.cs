using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class GroupTrainerSubstitutionsApiTests
{
    private const string Password = "substitution-tests-password";
    private const string BotToken = "substitution-bot-token";
    private static readonly DateOnly BusinessDate = new(2026, 7, 25);

    [Theory]
    [InlineData("headcoach")]
    [InlineData("administrator")]
    [InlineData("superadmin")]
    public async Task Manage_groups_roles_can_read_legacy_substitution_history_but_mutation_routes_are_absent(string login)
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, login);

        using var listResponse = await client.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions?historySkip=0&historyTake=20");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await ReadJsonElementAsync(listResponse);
        var current = Assert.Single(list.GetProperty("current").EnumerateArray());
        Assert.Equal(seeded.ActiveSubstitutionId!.Value, current.GetProperty("id").GetGuid());
        Assert.Equal("Active", current.GetProperty("status").GetString());
        Assert.Equal(0, list.GetProperty("history").GetProperty("totalCount").GetInt32());

        using var createResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.OtherCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(createResponse);

        using var updateResponse = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}",
            new { substituteTrainerId = seeded.OtherCoachId, startsOn = "2026-07-27", endsOn = "2026-07-29" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(updateResponse);

        using var cancelResponse = await PostWithoutBodyAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}/cancel",
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(cancelResponse);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var stored = await db.GroupTrainerSubstitutions.SingleAsync(item => item.Id == seeded.ActiveSubstitutionId);
        Assert.Null(stored.CancelledAt);
        Assert.Equal(seeded.SubstituteCoachId, stored.SubstituteTrainerId);
        Assert.Equal(BusinessDate, stored.StartsOn);
        Assert.Equal(BusinessDate, stored.EndsOn);
        Assert.Equal(0, await db.AuditLogs.CountAsync(log => log.EntityType == "GroupTrainerSubstitution"));
    }

    [Fact]
    public async Task Get_authorization_stays_enforced_while_legacy_mutation_routes_do_not_expose_write_contract()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);

        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        using var anonymousResponse = await anonymous.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var coachSession = await LoginAsync(coachClient, "coach");
        using (var coachGetResponse = await coachClient.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, coachGetResponse.StatusCode);
        }

        using var manager = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        _ = await LoginAsync(manager, "administrator");

        using (var managerGetResponse = await manager.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions"))
        {
            Assert.Equal(HttpStatusCode.OK, managerGetResponse.StatusCode);
        }

        using var coachPostResponse = await PostJsonAsync(
            coachClient,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
            coachSession.CsrfToken);
        AssertLegacyMutationRouteAbsent(coachPostResponse);
    }

    [Fact]
    public async Task Validation_and_conflicts_return_stable_problem_details()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, "headcoach");

        using (var inactiveListResponse = await client.GetAsync($"/groups/{seeded.InactiveGroupId}/trainer-substitutions"))
        {
            Assert.Equal(HttpStatusCode.OK, inactiveListResponse.StatusCode);
            var payload = await ReadJsonElementAsync(inactiveListResponse);
            Assert.False(payload.GetProperty("canCreate").GetBoolean());
            Assert.Equal("group_inactive", payload.GetProperty("createUnavailableReason").GetProperty("code").GetString());
        }

        using (var missingGroupGetResponse = await client.GetAsync($"/groups/{Guid.NewGuid()}/trainer-substitutions"))
        {
            Assert.Equal(HttpStatusCode.NotFound, missingGroupGetResponse.StatusCode);
        }

        using (var missingGroupPostResponse = await PostJsonAsync(
                   client,
                   $"/groups/{Guid.NewGuid()}/trainer-substitutions",
                   new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(missingGroupPostResponse);
        }

        using (var invalidPagingResponse = await client.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions?historySkip=-1&historyTake=101"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalidPagingResponse.StatusCode);
            var problem = await ReadJsonElementAsync(invalidPagingResponse);
            Assert.True(problem.GetProperty("errors").TryGetProperty("historySkip", out _));
            Assert.True(problem.GetProperty("errors").TryGetProperty("historyTake", out _));
        }

        using var createResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(createResponse);

        using (var noChangesResponse = await PutJsonAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}",
                   new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(noChangesResponse);
        }

        using (var missingSubstitutionUpdateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions/{Guid.NewGuid()}",
                   new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(missingSubstitutionUpdateResponse);
        }

        using (var missingSubstitutionCancelResponse = await PostWithoutBodyAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions/{Guid.NewGuid()}/cancel",
                   session.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(missingSubstitutionCancelResponse);
        }

        using var overlapResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-28", endsOn = "2026-07-30" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(overlapResponse);

        using var adjacentResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-29", endsOn = "2026-07-31" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(adjacentResponse);

        using var otherTrainerOverlap = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.OtherCoachId, startsOn = "2026-07-27", endsOn = "2026-07-30" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(otherTrainerOverlap);
    }

    [Fact]
    public async Task Legacy_update_and_cancel_routes_are_absent_even_when_substitute_became_permanent()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, "headcoach");

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.GroupTrainers.Add(new GroupTrainer { GroupId = seeded.GroupId, TrainerId = seeded.SubstituteCoachId });
            await db.SaveChangesAsync();
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}",
                   new { substituteTrainerId = seeded.OtherCoachId, startsOn = "2026-07-27", endsOn = "2026-07-29" },
                   session.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(updateResponse);
        }

        using var cancelResponse = await PostWithoutBodyAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}/cancel",
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(cancelResponse);

        await using var verifyScope = factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await verifyDb.AuditLogs.CountAsync(log => log.EntityType == "GroupTrainerSubstitution"));
        var stored = await verifyDb.GroupTrainerSubstitutions.SingleAsync(item => item.Id == seeded.ActiveSubstitutionId);
        Assert.Equal(seeded.SubstituteCoachId, stored.SubstituteTrainerId);
        Assert.Null(stored.CancelledAt);
    }

    [Fact]
    public async Task Legacy_update_route_absence_prevents_past_start_mutation()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true, substitutionStartsOn: new DateOnly(2026, 7, 26), substitutionEndsOn: new DateOnly(2026, 7, 28));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, "headcoach");

        using var updateResponse = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-24", endsOn = "2026-07-28" },
            session.CsrfToken);
        AssertLegacyMutationRouteAbsent(updateResponse);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var stored = await db.GroupTrainerSubstitutions.SingleAsync(item => item.Id == seeded.ActiveSubstitutionId);
        Assert.Equal(new DateOnly(2026, 7, 26), stored.StartsOn);
        Assert.Equal(0, await db.AuditLogs.CountAsync(log => log.EntityType == "GroupTrainerSubstitution"));
    }

    [Fact]
    public async Task List_orders_current_items_and_paginates_history_by_lifecycle_state()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory);
        var now = DateTimeOffset.Parse("2026-07-20T10:00:00Z");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.GroupTrainerSubstitutions.AddRange(
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seeded.GroupId,
                    SubstituteTrainerId = seeded.SubstituteCoachId,
                    StartsOn = new DateOnly(2026, 7, 24),
                    EndsOn = new DateOnly(2026, 7, 25),
                    CreatedByUserId = seeded.PrimaryCoachId,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seeded.GroupId,
                    SubstituteTrainerId = seeded.SubstituteCoachId,
                    StartsOn = new DateOnly(2026, 7, 26),
                    EndsOn = new DateOnly(2026, 7, 27),
                    CreatedByUserId = seeded.PrimaryCoachId,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seeded.GroupId,
                    SubstituteTrainerId = seeded.OtherCoachId,
                    StartsOn = new DateOnly(2026, 7, 20),
                    EndsOn = new DateOnly(2026, 7, 24),
                    CreatedByUserId = seeded.PrimaryCoachId,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seeded.GroupId,
                    SubstituteTrainerId = seeded.OtherCoachId,
                    StartsOn = new DateOnly(2026, 7, 19),
                    EndsOn = new DateOnly(2026, 7, 30),
                    CancelledAt = now,
                    CreatedByUserId = seeded.PrimaryCoachId,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        _ = await LoginAsync(client, "headcoach");
        using var response = await client.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions?historySkip=0&historyTake=1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var current = payload.GetProperty("current");
        Assert.Equal(2, current.GetArrayLength());
        Assert.Equal("Active", current[0].GetProperty("status").GetString());
        Assert.Equal("2026-07-24", current[0].GetProperty("startsOn").GetString());
        Assert.Equal("Upcoming", current[1].GetProperty("status").GetString());
        Assert.Equal("2026-07-26", current[1].GetProperty("startsOn").GetString());

        var history = payload.GetProperty("history");
        Assert.Equal(2, history.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, history.GetProperty("skip").GetInt32());
        Assert.Equal(1, history.GetProperty("take").GetInt32());
        var historyItems = history.GetProperty("items");
        Assert.Equal(1, historyItems.GetArrayLength());
        Assert.Equal("Expired", historyItems[0].GetProperty("status").GetString());
        Assert.Equal("2026-07-20", historyItems[0].GetProperty("startsOn").GetString());
    }

    [Fact]
    public async Task Legacy_substitution_does_not_grant_session_clients_attendance_photo_or_bot_group_wide_access()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);

        using var coach = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var coachSession = await LoginAsync(coach, "substitute");
        Assert.DoesNotContain(seeded.GroupId.ToString(), coachSession.User!.AssignedGroupIds);

        using (var clientsResponse = await coach.GetAsync("/clients?search=Scoped"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(clientsResponse);
            Assert.Equal(0, payload.GetProperty("items").GetArrayLength());
        }

        using (var detailsResponse = await coach.GetAsync($"/clients/{seeded.ClientId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, detailsResponse.StatusCode);
        }

        using (var attendanceGroups = await coach.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, attendanceGroups.StatusCode);
            var payload = await ReadJsonElementAsync(attendanceGroups);
            Assert.DoesNotContain(payload.GetProperty("groups").EnumerateArray(), item => item.GetProperty("id").GetGuid() == seeded.GroupId);
        }

        using (var roster = await coach.GetAsync($"/attendance/groups/{seeded.GroupId}/clients?trainingDate=2026-07-24"))
        {
            AssertForbiddenOrNotFound(roster);
        }

        using (var photo = await coach.GetAsync($"/clients/{seeded.ClientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, photo.StatusCode);
        }

        using var botClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        botClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BotToken);
        using (var botGroups = await botClient.GetAsync($"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.SubstituteTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, botGroups.StatusCode);
            var payload = await ReadJsonElementAsync(botGroups);
            Assert.DoesNotContain(payload.EnumerateArray(), item => item.GetProperty("id").GetGuid() == seeded.GroupId);
        }
        using (var botSearch = await botClient.GetAsync($"/internal/bot/clients?q=Scoped&platform=Telegram&platformUserId={seeded.SubstituteTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, botSearch.StatusCode);
            var payload = await ReadJsonElementAsync(botSearch);
            Assert.Equal(0, payload.GetProperty("items").GetArrayLength());
        }

        using var manager = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var managerSession = await LoginAsync(manager, "headcoach");
        using var cancelResponse = await PostWithoutBodyAsync(
            manager,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}/cancel",
            managerSession.CsrfToken);
        AssertLegacyMutationRouteAbsent(cancelResponse);

        using var newCoachClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var revokedSession = await LoginAsync(newCoachClient, "substitute");
        Assert.DoesNotContain(seeded.GroupId.ToString(), revokedSession.User!.AssignedGroupIds);
        using var revokedClient = await newCoachClient.GetAsync($"/clients/{seeded.ClientId}");
        Assert.Equal(HttpStatusCode.Forbidden, revokedClient.StatusCode);
    }

    [Theory]
    [InlineData(24, false)]
    [InlineData(25, false)]
    [InlineData(26, false)]
    [InlineData(27, false)]
    public async Task Effective_scope_uses_inclusive_substitution_dates_without_removing_permanent_or_management_access(
        int businessDay,
        bool substituteHasAccess)
    {
        var today = new DateOnly(2026, 7, businessDay);
        await using var factory = new SubstitutionAppFactory(today);
        var seeded = await SeedAsync(
            factory,
            createActiveSubstitution: true,
            substitutionStartsOn: new DateOnly(2026, 7, 25),
            substitutionEndsOn: new DateOnly(2026, 7, 26));

        using var substituteClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var substituteSession = await LoginAsync(substituteClient, "substitute");
        if (substituteHasAccess)
        {
            Assert.Contains(seeded.GroupId.ToString(), substituteSession.User!.AssignedGroupIds);
            using var allowedClient = await substituteClient.GetAsync($"/clients/{seeded.ClientId}");
            Assert.Equal(HttpStatusCode.OK, allowedClient.StatusCode);
        }
        else
        {
            Assert.DoesNotContain(seeded.GroupId.ToString(), substituteSession.User!.AssignedGroupIds);
            using var forbiddenClient = await substituteClient.GetAsync($"/clients/{seeded.ClientId}");
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenClient.StatusCode);
        }

        using var permanentClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var permanentSession = await LoginAsync(permanentClient, "primary");
        Assert.Contains(seeded.GroupId.ToString(), permanentSession.User!.AssignedGroupIds);
        using (var permanentAccess = await permanentClient.GetAsync($"/clients/{seeded.ClientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, permanentAccess.StatusCode);
        }

        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        _ = await LoginAsync(managerClient, "headcoach");
        using var managerList = await managerClient.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions");
        Assert.Equal(HttpStatusCode.OK, managerList.StatusCode);
    }

    private static async Task<SeededData> SeedAsync(
        SubstitutionAppFactory factory,
        bool createActiveSubstitution = false,
        DateOnly? substitutionStartsOn = null,
        DateOnly? substitutionEndsOn = null)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = DateTimeOffset.Parse("2026-07-20T10:00:00Z");
        var branchId = Guid.NewGuid();
        var hallId = Guid.NewGuid();
        var groupTypeId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var inactiveGroupId = Guid.NewGuid();
        var primaryCoachId = Guid.NewGuid();
        var substituteCoachId = Guid.NewGuid();
        var otherCoachId = Guid.NewGuid();
        var inactiveCoachId = Guid.NewGuid();
        var badRoleUserId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var substitutionId = Guid.NewGuid();
        var photoPath = $"{clientId:N}.jpg";

        Directory.CreateDirectory(factory.PhotoStorageRootPath);
        await File.WriteAllBytesAsync(Path.Combine(factory.PhotoStorageRootPath, photoPath), [0x01, 0x02, 0x03]);

        db.Branches.Add(new Branch { Id = branchId, Name = "Branch", CreatedAt = now, UpdatedAt = now });
        db.Halls.Add(new Hall { Id = hallId, BranchId = branchId, Name = "Hall", CreatedAt = now, UpdatedAt = now });
        db.GroupTypes.Add(new GroupType { Id = groupTypeId, Name = "Group Type", CreatedAt = now, UpdatedAt = now });
        db.Users.AddRange(
            CreateUser(Guid.NewGuid(), "headcoach", UserRole.HeadCoach, passwordHashService, now),
            CreateUser(Guid.NewGuid(), "administrator", UserRole.Administrator, passwordHashService, now, branchId),
            CreateUser(Guid.NewGuid(), "superadmin", UserRole.SuperAdministrator, passwordHashService, now),
            CreateUser(Guid.NewGuid(), "coach", UserRole.Coach, passwordHashService, now),
            CreateUser(primaryCoachId, "primary", UserRole.Coach, passwordHashService, now),
            CreateUser(substituteCoachId, "substitute", UserRole.Coach, passwordHashService, now, telegramId: "substitute-telegram"),
            CreateUser(otherCoachId, "other", UserRole.Coach, passwordHashService, now),
            CreateUser(inactiveCoachId, "inactive", UserRole.Coach, passwordHashService, now, isActive: false),
            CreateUser(badRoleUserId, "badrole", UserRole.Administrator, passwordHashService, now, branchId));
        db.TrainingGroups.AddRange(
            new TrainingGroup
            {
                Id = groupId,
                BranchId = branchId,
                HallId = hallId,
                GroupTypeId = groupTypeId,
                Name = "Scoped Group",
                TrainingStartTime = new TimeOnly(10, 0),
                DurationMinutes = 60,
                Weekdays = [1, 3, 5],
                CreatedAt = now,
                UpdatedAt = now,
                IsActive = true
            },
            new TrainingGroup
            {
                Id = inactiveGroupId,
                BranchId = branchId,
                HallId = hallId,
                GroupTypeId = groupTypeId,
                Name = "Inactive Group",
                TrainingStartTime = new TimeOnly(12, 0),
                DurationMinutes = 60,
                Weekdays = [2],
                CreatedAt = now,
                UpdatedAt = now,
                IsActive = false
            });
        db.GroupTrainers.Add(new GroupTrainer { GroupId = groupId, TrainerId = primaryCoachId });
        db.Clients.Add(new Client
        {
            Id = clientId,
            BranchId = branchId,
            LastName = "Scoped",
            FirstName = "Client",
            Phone = "+79990000000",
            PhotoPath = photoPath,
            PhotoContentType = "image/jpeg",
            PhotoSizeBytes = 3,
            PhotoUploadedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ClientGroups.Add(new ClientGroup { ClientId = clientId, GroupId = groupId, BranchId = branchId });
        if (createActiveSubstitution)
        {
            db.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
            {
                Id = substitutionId,
                GroupId = groupId,
                SubstituteTrainerId = substituteCoachId,
                StartsOn = substitutionStartsOn ?? BusinessDate,
                EndsOn = substitutionEndsOn ?? BusinessDate,
                CreatedByUserId = primaryCoachId,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await db.SaveChangesAsync();
        return new SeededData(
            groupId,
            inactiveGroupId,
            primaryCoachId,
            substituteCoachId,
            otherCoachId,
            inactiveCoachId,
            badRoleUserId,
            clientId,
            createActiveSubstitution ? substitutionId : null,
            "substitute-telegram");
    }

    private static User CreateUser(
        Guid id,
        string login,
        UserRole role,
        IPasswordHashService passwordHashService,
        DateTimeOffset now,
        Guid? branchId = null,
        string? telegramId = null,
        bool isActive = true)
    {
        var user = new User
        {
            Id = id,
            FullName = login,
            Login = login,
            Role = role,
            BranchId = branchId,
            MessengerPlatform = telegramId is null ? null : MessengerPlatform.Telegram,
            MessengerPlatformUserId = telegramId,
            MustChangePassword = false,
            IsActive = isActive,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = passwordHashService.HashPassword(user, Password);
        return user;
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login)
    {
        using var initial = await client.GetAsync("/auth/session");
        var session = await ReadJsonAsync<SessionPayload>(initial);
        using var response = await PostJsonAsync(client, "/auth/login", new { login, password = Password }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync<SessionPayload>(response);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<T>(HttpClient client, string path, T payload, string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(payload) };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutJsonAsync<T>(HttpClient client, string path, T payload, string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path) { Content = JsonContent.Create(payload) };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(HttpClient client, string path, string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        return document.RootElement.Clone();
    }

    private static void AssertLegacyMutationRouteAbsent(HttpResponseMessage response)
    {
        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected legacy mutation route absence (404/405), got {response.StatusCode}.");
    }

    private static void AssertForbiddenOrNotFound(HttpResponseMessage response)
    {
        Assert.True(
            response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"Expected forbidden or scoped not found response, got {response.StatusCode}.");
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record SeededData(
        Guid GroupId,
        Guid InactiveGroupId,
        Guid PrimaryCoachId,
        Guid SubstituteCoachId,
        Guid OtherCoachId,
        Guid InactiveCoachId,
        Guid BadRoleUserId,
        Guid ClientId,
        Guid? ActiveSubstitutionId,
        string SubstituteTelegramId);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role, string[] AssignedGroupIds);

    private sealed class SubstitutionAppFactory(DateOnly businessDate, bool throwAudit = false) : WebApplicationFactory<Program>
    {
        public string PhotoStorageRootPath { get; } = Path.Combine(Path.GetTempPath(), $"gym-crm-substitution-photos-{Guid.NewGuid():N}");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-substitutions",
                    ["BootstrapUser:FullName"] = "Bootstrap Substitutions",
                    ["ClientPhoto:StorageRootPath"] = PhotoStorageRootPath,
                    ["BotInternalApi:Enabled"] = "true",
                    ["BotInternalApi:Token"] = BotToken
                });
            });
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();
                var databaseName = $"gym-crm-substitution-tests-{Guid.NewGuid():N}";
                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
                services.RemoveAll<IBusinessDateProvider>();
                services.AddSingleton<IBusinessDateProvider>(new FixedBusinessDateProvider(businessDate));
                if (throwAudit)
                {
                    services.RemoveAll<IAuditLogService>();
                    services.AddScoped<IAuditLogService, ThrowingAuditLogService>();
                }
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing && Directory.Exists(PhotoStorageRootPath))
            {
                try
                {
                    Directory.Delete(PhotoStorageRootPath, recursive: true);
                }
                catch (IOException)
                {
                }
                catch (UnauthorizedAccessException)
                {
                }
            }
        }
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }

    private sealed class ThrowingAuditLogService : IAuditLogService
    {
        public Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("Audit failure for substitution rollback test.");
    }
}
