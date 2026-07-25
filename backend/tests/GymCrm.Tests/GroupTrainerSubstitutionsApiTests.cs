using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
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
    public async Task Manage_groups_roles_can_create_update_cancel_and_list_with_atomic_audit(string login)
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, login);

        using var createResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new
            {
                substituteTrainerId = seeded.SubstituteCoachId,
                startsOn = "2026-07-26",
                endsOn = "2026-07-28"
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await ReadJsonElementAsync(createResponse);
        var substitutionId = created.GetProperty("id").GetGuid();
        Assert.Equal("Upcoming", created.GetProperty("status").GetString());
        Assert.True(created.GetProperty("allowedActions").GetProperty("canEdit").GetBoolean());
        Assert.True(created.GetProperty("allowedActions").GetProperty("canCancel").GetBoolean());

        using var updateResponse = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{substitutionId}",
            new
            {
                substituteTrainerId = seeded.OtherCoachId,
                startsOn = "2026-07-27",
                endsOn = "2026-07-29"
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await ReadJsonElementAsync(updateResponse);
        Assert.Equal(seeded.OtherCoachId, updated.GetProperty("substituteTrainer").GetProperty("id").GetGuid());
        Assert.Equal("2026-07-27", updated.GetProperty("startsOn").GetString());

        using var listResponse = await client.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions?historySkip=0&historyTake=20");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await ReadJsonElementAsync(listResponse);
        Assert.True(list.GetProperty("canCreate").GetBoolean());
        Assert.Equal(1, list.GetProperty("current").GetArrayLength());
        Assert.Equal(0, list.GetProperty("history").GetProperty("totalCount").GetInt32());

        using var cancelResponse = await PostWithoutBodyAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{substitutionId}/cancel",
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
        var cancelled = await ReadJsonElementAsync(cancelResponse);
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
        Assert.False(cancelled.GetProperty("allowedActions").GetProperty("canEdit").GetBoolean());
        Assert.False(cancelled.GetProperty("allowedActions").GetProperty("canCancel").GetBoolean());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var stored = await db.GroupTrainerSubstitutions.SingleAsync(item => item.Id == substitutionId);
        Assert.NotNull(stored.CancelledAt);
        Assert.False(await db.GroupTrainerAssignments.AnyAsync(item => item.TrainerId == seeded.SubstituteCoachId || item.TrainerId == seeded.OtherCoachId));
        Assert.Equal(3, await db.AuditLogs.CountAsync(log => log.EntityType == GroupAuditConstants.GroupTrainerSubstitutionEntityType));
    }

    [Fact]
    public async Task Coach_anonymous_and_missing_csrf_cannot_mutate_substitutions()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var coachSession = await LoginAsync(coachClient, "coach");
        using var coachResponse = await PostJsonAsync(
            coachClient,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, coachResponse.StatusCode);

        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        using var anonymousResponse = await anonymous.GetAsync($"/groups/{seeded.GroupId}/trainer-substitutions");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        using var manager = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        _ = await LoginAsync(manager, "administrator");
        using var missingCsrf = await manager.PostAsJsonAsync(
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" });
        Assert.Equal(HttpStatusCode.BadRequest, missingCsrf.StatusCode);
    }

    [Fact]
    public async Task Validation_and_conflicts_return_stable_problem_details()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var session = await LoginAsync(client, "headcoach");

        using (var mainTrainerResponse = await PostJsonAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions",
                   new { substituteTrainerId = seeded.PrimaryCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, mainTrainerResponse.StatusCode);
            var problem = await ReadJsonElementAsync(mainTrainerResponse);
            Assert.True(problem.GetProperty("errors").TryGetProperty("substituteTrainerId", out _));
        }

        using (var reversedResponse = await PostJsonAsync(
                   client,
                   $"/groups/{seeded.GroupId}/trainer-substitutions",
                   new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-29", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, reversedResponse.StatusCode);
            var problem = await ReadJsonElementAsync(reversedResponse);
            Assert.True(problem.GetProperty("errors").TryGetProperty("endsOn", out _));
        }

        using (var inactiveGroupResponse = await PostJsonAsync(
                   client,
                   $"/groups/{seeded.InactiveGroupId}/trainer-substitutions",
                   new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, inactiveGroupResponse.StatusCode);
            var problem = await ReadJsonElementAsync(inactiveGroupResponse);
            Assert.True(problem.GetProperty("errors").TryGetProperty("groupId", out _));
        }

        using var createResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-26", endsOn = "2026-07-28" },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        using var overlapResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-28", endsOn = "2026-07-30" },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, overlapResponse.StatusCode);
        var overlapProblem = await ReadJsonElementAsync(overlapResponse);
        Assert.Equal("group-trainer-substitution-overlap", overlapProblem.GetProperty("type").GetString());
        Assert.True(overlapProblem.GetProperty("errors").TryGetProperty("startsOn", out _));
        Assert.True(overlapProblem.GetProperty("errors").TryGetProperty("endsOn", out _));

        using var adjacentResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.SubstituteCoachId, startsOn = "2026-07-29", endsOn = "2026-07-31" },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Created, adjacentResponse.StatusCode);

        using var otherTrainerOverlap = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions",
            new { substituteTrainerId = seeded.OtherCoachId, startsOn = "2026-07-27", endsOn = "2026-07-30" },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Created, otherTrainerOverlap.StatusCode);
    }

    [Fact]
    public async Task Effective_scope_applies_to_session_clients_attendance_photo_and_bot_on_business_date_then_revokes_on_cancel()
    {
        await using var factory = new SubstitutionAppFactory(BusinessDate);
        var seeded = await SeedAsync(factory, createActiveSubstitution: true);

        using var coach = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var coachSession = await LoginAsync(coach, "substitute");
        Assert.Contains(seeded.GroupId.ToString(), coachSession.User!.AssignedGroupIds);

        using (var clientsResponse = await coach.GetAsync("/clients?search=Scoped"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(clientsResponse);
            Assert.Equal(1, payload.GetProperty("items").GetArrayLength());
        }

        using (var detailsResponse = await coach.GetAsync($"/clients/{seeded.ClientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, detailsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(detailsResponse);
            Assert.Equal(seeded.GroupId, payload.GetProperty("groups")[0].GetProperty("id").GetGuid());
        }

        using (var attendanceGroups = await coach.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, attendanceGroups.StatusCode);
            var payload = await ReadJsonElementAsync(attendanceGroups);
            Assert.Contains(payload.GetProperty("groups").EnumerateArray(), item => item.GetProperty("id").GetGuid() == seeded.GroupId);
        }

        using (var roster = await coach.GetAsync($"/attendance/groups/{seeded.GroupId}/clients?trainingDate=2026-07-24"))
        {
            Assert.Equal(HttpStatusCode.OK, roster.StatusCode);
        }

        using (var photo = await coach.GetAsync($"/clients/{seeded.ClientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.OK, photo.StatusCode);
        }

        using var botClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        botClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BotToken);
        using (var botGroups = await botClient.GetAsync($"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.SubstituteTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, botGroups.StatusCode);
            var payload = await ReadJsonElementAsync(botGroups);
            Assert.Contains(payload.EnumerateArray(), item => item.GetProperty("id").GetGuid() == seeded.GroupId);
        }
        using (var botSearch = await botClient.GetAsync($"/internal/bot/clients?q=Scoped&platform=Telegram&platformUserId={seeded.SubstituteTelegramId}"))
        {
            Assert.Equal(HttpStatusCode.OK, botSearch.StatusCode);
            var payload = await ReadJsonElementAsync(botSearch);
            Assert.Equal(1, payload.GetProperty("items").GetArrayLength());
        }

        using var manager = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var managerSession = await LoginAsync(manager, "headcoach");
        using var cancelResponse = await PostWithoutBodyAsync(
            manager,
            $"/groups/{seeded.GroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}/cancel",
            managerSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);

        using var newCoachClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var revokedSession = await LoginAsync(newCoachClient, "substitute");
        Assert.DoesNotContain(seeded.GroupId.ToString(), revokedSession.User!.AssignedGroupIds);
        using var revokedClient = await newCoachClient.GetAsync($"/clients/{seeded.ClientId}");
        Assert.Equal(HttpStatusCode.Forbidden, revokedClient.StatusCode);
    }

    private static async Task<SeededData> SeedAsync(SubstitutionAppFactory factory, bool createActiveSubstitution = false)
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
            CreateUser(Guid.NewGuid(), "inactive", UserRole.Coach, passwordHashService, now, isActive: false),
            CreateUser(Guid.NewGuid(), "badrole", UserRole.Administrator, passwordHashService, now, branchId));
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
                StartsOn = BusinessDate,
                EndsOn = BusinessDate,
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
        return new User
        {
            Id = id,
            FullName = login,
            Login = login,
            PasswordHash = passwordHashService.HashPassword(Password),
            Role = role,
            BranchId = branchId,
            MessengerPlatform = telegramId is null ? null : MessengerPlatform.Telegram,
            MessengerPlatformUserId = telegramId,
            MustChangePassword = false,
            IsActive = isActive,
            CreatedAt = now,
            UpdatedAt = now
        };
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
                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase($"gym-crm-substitution-tests-{Guid.NewGuid():N}")
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
