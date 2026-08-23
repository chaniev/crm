using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using GymCrm.Application.Scheduling;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class GroupSchedulePostgreSqlConcurrencyTests(
    GroupSchedulePostgreSqlConcurrencyTests.PostgreSqlFixture fixture)
    : IClassFixture<GroupSchedulePostgreSqlConcurrencyTests.PostgreSqlFixture>
{
    private const string Password = "task119-postgres-password";
    private static readonly DateTimeOffset SeededAt = new(2026, 8, 23, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly FutureStart = new(2035, 1, 1);

    [Fact]
    public async Task PostgreSql_group_create_concurrent_execute_consumes_one_token_and_commits_one_group()
    {
        await using var context = await CreateContextAsync();
        using var firstClient = context.CreateClient();
        using var secondClient = context.CreateClient();
        var firstCsrf = await LoginAsync(firstClient, context.Seeded.ManagerLogin);
        var secondCsrf = await LoginAsync(secondClient, context.Seeded.ManagerLogin);
        var request = CreateGroupCreatePayload(context, "PostgreSQL concurrent create");
        var preview = await PreviewAsync(firstClient, "/groups/preview", request, firstCsrf);
        var executePayload = WithToken(request, preview.GetProperty("confirmationToken").GetString());

        var firstTask = PostJsonAsync(firstClient, "/groups", executePayload, firstCsrf);
        var secondTask = PostJsonAsync(secondClient, "/groups", executePayload, secondCsrf);

        using var first = await firstTask;
        using var second = await secondTask;
        AssertOneSuccessAndOneConflict(first, second, HttpStatusCode.Created);

        await using var db = context.CreateDbContext();
        var groupIds = await db.TrainingGroups
            .AsNoTracking()
            .Where(group => group.Name == "PostgreSQL concurrent create")
            .Select(group => group.Id)
            .ToArrayAsync();
        var groupId = Assert.Single(groupIds);
        Assert.Equal(1, await db.LessonSeries.CountAsync(series => series.GroupId == groupId));
        Assert.Equal(1, await db.LessonScheduleRuleVersions.CountAsync(version => version.LessonSeries.GroupId == groupId));
        Assert.Equal(1, await db.LessonScheduleSlots.CountAsync(slot => slot.RuleVersion.LessonSeries.GroupId == groupId));
        Assert.Equal(1, await db.ScheduleMutationConfirmationTokens.CountAsync(token =>
            token.Purpose == ScheduleMutationTokenPolicy.GroupCreatePurpose &&
            token.ConsumedAt != null));
        Assert.Equal(1, await db.AuditLogs.CountAsync(log =>
            log.ActionType == "TrainingGroupCreated" &&
            log.EntityType == "TrainingGroup" &&
            log.EntityId == groupId.ToString()));
    }

    [Fact]
    public async Task PostgreSql_trainer_assignment_concurrent_execute_consumes_one_token_and_preserves_history()
    {
        await using var context = await CreateContextAsync();
        using var firstClient = context.CreateClient();
        using var secondClient = context.CreateClient();
        var firstCsrf = await LoginAsync(firstClient, context.Seeded.ManagerLogin);
        var secondCsrf = await LoginAsync(secondClient, context.Seeded.ManagerLogin);
        var request = new
        {
            assignments = new[]
            {
                new
                {
                    trainerId = context.Seeded.CoachOneId,
                    validFrom = "2035-01-08",
                    validTo = (string?)null
                }
            }
        };
        var preview = await PreviewAsync(
            firstClient,
            $"/groups/{context.Seeded.GroupOneId}/trainer-assignments/preview",
            request,
            firstCsrf);
        var executePayload = new
        {
            request.assignments,
            expectedRevision = preview.GetProperty("revision").GetString(),
            confirmationToken = preview.GetProperty("confirmationToken").GetString()
        };

        var firstTask = PostJsonAsync(firstClient, $"/groups/{context.Seeded.GroupOneId}/trainer-assignments", executePayload, firstCsrf);
        var secondTask = PostJsonAsync(secondClient, $"/groups/{context.Seeded.GroupOneId}/trainer-assignments", executePayload, secondCsrf);

        using var first = await firstTask;
        using var second = await secondTask;
        AssertOneSuccessAndOneConflict(first, second, HttpStatusCode.OK);

        await using var db = context.CreateDbContext();
        Assert.True(await db.GroupTrainerAssignments.AnyAsync(assignment =>
            assignment.GroupId == context.Seeded.GroupOneId &&
            assignment.TrainerId == context.Seeded.CoachTwoId &&
            assignment.ValidTo == FutureStart.AddDays(6)));
        Assert.Equal(1, await db.GroupTrainerAssignments.CountAsync(assignment =>
            assignment.GroupId == context.Seeded.GroupOneId &&
            assignment.TrainerId == context.Seeded.CoachOneId &&
            assignment.ValidFrom == FutureStart.AddDays(7) &&
            assignment.ValidTo == null));
        Assert.Equal(1, await db.ScheduleMutationConfirmationTokens.CountAsync(token =>
            token.Purpose == ScheduleMutationTokenPolicy.GroupTrainerAssignmentsPurpose &&
            token.ConsumedAt != null));
    }

    [Fact]
    public async Task PostgreSql_exact_trainer_substitution_concurrent_execute_consumes_one_token_and_commits_one_substitution()
    {
        await using var context = await CreateContextAsync();
        using var firstClient = context.CreateClient();
        using var secondClient = context.CreateClient();
        var firstCsrf = await LoginAsync(firstClient, context.Seeded.ManagerLogin);
        var secondCsrf = await LoginAsync(secondClient, context.Seeded.ManagerLogin);
        var lesson = await LoadSingleCalendarLessonAsync(firstClient, context.Seeded.GroupOneId, "2035-01-01");
        var occurrenceId = Guid.Parse(lesson.GetProperty("lessonOccurrenceId").GetString()!);
        var revision = lesson.GetProperty("revision").GetString();
        var request = new
        {
            replacedTrainerId = context.Seeded.CoachTwoId,
            substituteTrainerId = context.Seeded.CoachOneId,
            targets = new[]
            {
                new
                {
                    lessonOccurrenceId = occurrenceId,
                    lessonDate = "2035-01-01",
                    expectedRevision = revision
                }
            }
        };
        var preview = await PreviewAsync(
            firstClient,
            "/schedule/lesson-trainer-substitutions/preview",
            request,
            firstCsrf);
        var executePayload = new
        {
            request.replacedTrainerId,
            request.substituteTrainerId,
            request.targets,
            confirmationToken = preview.GetProperty("confirmationToken").GetString()
        };

        var firstTask = PostJsonAsync(firstClient, "/schedule/lesson-trainer-substitutions", executePayload, firstCsrf);
        var secondTask = PostJsonAsync(secondClient, "/schedule/lesson-trainer-substitutions", executePayload, secondCsrf);

        using var first = await firstTask;
        using var second = await secondTask;
        AssertOneSuccessAndOneConflict(first, second, HttpStatusCode.OK);

        await using var db = context.CreateDbContext();
        Assert.Equal(1, await db.LessonOccurrences.CountAsync(occurrence => occurrence.Id == occurrenceId));
        var substitution = await db.LessonOccurrenceTrainerSubstitutions
            .AsNoTracking()
            .SingleAsync(item => item.LessonOccurrenceId == occurrenceId);
        Assert.Equal(context.Seeded.CoachTwoId, substitution.ReplacedTrainerId);
        Assert.Equal(context.Seeded.CoachOneId, substitution.SubstituteTrainerId);
        Assert.Null(substitution.CancelledAt);
        Assert.Equal(1, await db.ScheduleMutationConfirmationTokens.CountAsync(token =>
            token.Purpose == ScheduleMutationTokenPolicy.LessonTrainerSubstitutionPurpose &&
            token.ConsumedAt != null));
        Assert.Equal(1, await db.AuditLogs.CountAsync(log =>
            log.ActionType == "LessonOccurrenceTrainerSubstitutionCreated" &&
            log.EntityType == "LessonOccurrenceTrainerSubstitution"));
    }

    [Fact]
    public async Task PostgreSql_lesson_series_execute_splits_versions_preserves_lineage_and_replay_leaves_graph_stable()
    {
        await using var context = await CreateContextAsync();
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        await using (var beforeDb = context.CreateDbContext())
        {
            var originalSlot = await beforeDb.LessonScheduleSlots
                .AsNoTracking()
                .SingleAsync(slot => slot.RuleVersion.LessonSeries.GroupId == context.Seeded.GroupOneId);
            Assert.NotEqual(Guid.Empty, originalSlot.SlotLineageId);
        }

        var request = new
        {
            scope = "ThisAndFuture",
            effectiveFrom = "2035-01-08",
            endsOn = (string?)null,
            slots = new[]
            {
                new
                {
                    isoWeekday = ToIsoWeekday(new DateOnly(2035, 1, 8)),
                    startTime = "12:00",
                    durationMinutes = 75,
                    hallId = context.Seeded.HallOneId
                }
            }
        };
        var preview = await PreviewAsync(
            client,
            $"/groups/{context.Seeded.GroupOneId}/lesson-series/preview",
            request,
            csrf);

        var executePayload = new
        {
            request.scope,
            request.effectiveFrom,
            request.endsOn,
            request.slots,
            expectedRevision = preview.GetProperty("revision").GetString(),
            confirmationToken = preview.GetProperty("confirmationToken").GetString()
        };
        using var executeResponse = await PostJsonAsync(
            client,
            $"/groups/{context.Seeded.GroupOneId}/lesson-series",
            executePayload,
            csrf);
        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);

        using var replayResponse = await PostJsonAsync(
            client,
            $"/groups/{context.Seeded.GroupOneId}/lesson-series",
            executePayload,
            csrf);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        var replayProblem = await ReadJsonElementAsync(replayResponse);
        Assert.Equal(ScheduleMutationTokenPolicy.PreviewInvalidCode, replayProblem.GetProperty("code").GetString());

        await using var db = context.CreateDbContext();
        var series = await db.LessonSeries
            .AsNoTracking()
            .SingleAsync(candidate => candidate.GroupId == context.Seeded.GroupOneId);
        var versions = await db.LessonScheduleRuleVersions
            .AsNoTracking()
            .Include(version => version.Slots)
            .Where(version => version.LessonSeriesId == series.Id)
            .OrderBy(version => version.EffectiveFrom)
            .ToArrayAsync();
        Assert.Equal(2, versions.Length);
        Assert.Equal(new DateOnly(2035, 1, 7), versions[0].EffectiveTo);
        Assert.Equal(new DateOnly(2035, 1, 8), versions[1].EffectiveFrom);
        var originalLineage = Assert.Single(versions[0].Slots).SlotLineageId;
        var replacementSlot = Assert.Single(versions[1].Slots);
        Assert.Equal(originalLineage, replacementSlot.SlotLineageId);
        Assert.Equal(new TimeOnly(12, 0), replacementSlot.StartTime);
        Assert.Equal(1, await db.ScheduleMutationConfirmationTokens.CountAsync(token =>
            token.Purpose == ScheduleMutationTokenPolicy.GroupLessonSeriesPurpose &&
            token.ConsumedAt != null));
        Assert.Equal(1, await db.AuditLogs.CountAsync(log =>
            log.ActionType == "LessonSeriesUpdated" &&
            log.EntityType == "LessonSeries" &&
            log.EntityId == series.Id.ToString()));
    }

    [Fact]
    public async Task PostgreSql_trainer_assignment_preview_warns_when_assignment_intersects_other_group_schedule_time()
    {
        await using var context = await CreateContextAsync();
        using var client = context.CreateClient();
        var csrf = await LoginAsync(client, context.Seeded.ManagerLogin);
        var request = new
        {
            assignments = new[]
            {
                new
                {
                    trainerId = context.Seeded.CoachOneId,
                    validFrom = "2035-01-01",
                    validTo = (string?)null
                }
            }
        };

        using var response = await PostJsonAsync(
            client,
            $"/groups/{context.Seeded.GroupOneId}/trainer-assignments/preview",
            request,
            csrf);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var warning = Assert.Single(payload.GetProperty("warnings").EnumerateArray());
        Assert.Equal("group_trainer_assignment_overlap", warning.GetProperty("code").GetString());
        Assert.True(payload.GetProperty("impact").GetProperty("totalAffectedOccurrences").GetInt32() > 0);
    }

    private async Task<TestContext> CreateContextAsync()
    {
        await fixture.AcquireAsync();
        TestAppFactory? factory = null;
        try
        {
            await using (var migrationDb = CreateDbContext(fixture.ConnectionString))
            {
                await migrationDb.Database.EnsureDeletedAsync();
                await migrationDb.Database.MigrateAsync();
            }

            factory = new TestAppFactory(fixture.ConnectionString);
            var seeded = await SeedAsync(factory);
            return new TestContext(fixture.ConnectionString, factory, seeded, fixture.Release);
        }
        catch
        {
            if (factory is not null)
            {
                await factory.DisposeAsync();
            }

            fixture.Release();
            throw;
        }
    }

    private static async Task<SeededData> SeedAsync(TestAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var manager = CreateUser("task119-pg-manager", "TASK-119 PostgreSQL Manager", UserRole.HeadCoach, passwordHashService);
        var coachOne = CreateUser("task119-pg-coach-one", "TASK-119 PostgreSQL Coach One", UserRole.Coach, passwordHashService);
        var coachTwo = CreateUser("task119-pg-coach-two", "TASK-119 PostgreSQL Coach Two", UserRole.Coach, passwordHashService);
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "TASK-119 PostgreSQL Branch",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var hallOne = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "TASK-119 PostgreSQL Hall One",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var hallTwo = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "TASK-119 PostgreSQL Hall Two",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "TASK-119 PostgreSQL Type",
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var groupOne = CreateGroup(branch.Id, hallOne.Id, groupType.Id, "TASK-119 PostgreSQL Group One", new TimeOnly(10, 0));
        var groupTwo = CreateGroup(branch.Id, hallTwo.Id, groupType.Id, "TASK-119 PostgreSQL Group Two", new TimeOnly(10, 30));

        db.Users.AddRange(manager, coachOne, coachTwo);
        db.Branches.Add(branch);
        db.Halls.AddRange(hallOne, hallTwo);
        db.GroupTypes.Add(groupType);
        db.TrainingGroups.AddRange(groupOne, groupTwo);
        db.GroupTrainers.Add(new GroupTrainer { GroupId = groupOne.Id, TrainerId = coachTwo.Id });
        db.GroupTrainers.Add(new GroupTrainer { GroupId = groupTwo.Id, TrainerId = coachOne.Id });
        db.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupOne.Id,
            TrainerId = coachTwo.Id,
            ValidFrom = FutureStart,
            CreatedByUserId = manager.Id,
            CreatedAt = SeededAt
        });
        db.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupTwo.Id,
            TrainerId = coachOne.Id,
            ValidFrom = FutureStart,
            CreatedByUserId = manager.Id,
            CreatedAt = SeededAt
        });
        AddSeries(db, groupOne.Id, hallOne.Id, FutureStart, new TimeOnly(10, 0));
        AddSeries(db, groupTwo.Id, hallTwo.Id, FutureStart, new TimeOnly(10, 30));
        await db.SaveChangesAsync();

        return new SeededData(
            manager.Login,
            manager.Id,
            coachOne.Id,
            coachTwo.Id,
            branch.Id,
            hallOne.Id,
            hallTwo.Id,
            groupType.Id,
            groupOne.Id,
            groupTwo.Id);
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        IPasswordHashService passwordHashService)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = role,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        user.PasswordHash = passwordHashService.HashPassword(user, Password);
        return user;
    }

    private static TrainingGroup CreateGroup(Guid branchId, Guid hallId, Guid groupTypeId, string name, TimeOnly startTime)
    {
        return new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            HallId = hallId,
            GroupTypeId = groupTypeId,
            Name = name,
            TrainingStartTime = startTime,
            DurationMinutes = 60,
            Weekdays = [1],
            IsActive = true,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
    }

    private static void AddSeries(GymCrmDbContext db, Guid groupId, Guid hallId, DateOnly startsOn, TimeOnly startTime)
    {
        var series = new LessonSeries
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            StartsOn = startsOn,
            CreatedAt = SeededAt,
            UpdatedAt = SeededAt
        };
        var rule = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = series.Id,
            VersionNumber = 1,
            EffectiveFrom = startsOn,
            CreatedAt = SeededAt
        };
        rule.Slots.Add(new LessonScheduleSlot
        {
            Id = Guid.NewGuid(),
            LessonScheduleRuleVersionId = rule.Id,
            SlotLineageId = Guid.NewGuid(),
            IsoWeekday = ToIsoWeekday(startsOn),
            StartTime = startTime,
            DurationMinutes = 60,
            HallId = hallId,
            CreatedAt = SeededAt
        });

        db.LessonSeries.Add(series);
        db.LessonScheduleRuleVersions.Add(rule);
    }

    private static object CreateGroupCreatePayload(TestContext context, string name)
    {
        return new
        {
            name,
            branchId = context.Seeded.BranchId,
            hallId = context.Seeded.HallOneId,
            groupTypeId = context.Seeded.GroupTypeId,
            trainingStartTime = "09:00",
            durationMinutes = 60,
            weekdays = new[] { 1 },
            isActive = true,
            trainerIds = new[] { context.Seeded.CoachOneId },
            initialLessonSeries = new
            {
                startsOn = "2035-01-01",
                endsOn = (string?)null,
                slots = new[]
                {
                    new
                    {
                        isoWeekday = ToIsoWeekday(FutureStart),
                        startTime = "09:00",
                        durationMinutes = 60,
                        hallId = context.Seeded.HallOneId
                    }
                }
            }
        };
    }

    private static async Task<JsonElement> PreviewAsync(HttpClient client, string path, object request, string csrfToken)
    {
        using var response = await PostJsonAsync(client, path, request, csrfToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonElementAsync(response);
    }

    private static async Task<JsonElement> LoadSingleCalendarLessonAsync(
        HttpClient client,
        Guid groupId,
        string lessonDate)
    {
        using var response = await client.GetAsync($"/schedule/lessons?from={lessonDate}&to={lessonDate}&groupId={groupId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        return Assert.Single(payload.GetProperty("items").EnumerateArray());
    }

    private static JsonObject WithToken(object request, string? confirmationToken)
    {
        var executePayload = JsonSerializer.SerializeToNode(request)?.AsObject()
            ?? throw new InvalidOperationException("Request did not serialize to a JSON object.");
        executePayload["confirmationToken"] = confirmationToken;
        return executePayload;
    }

    private static async Task<string> LoginAsync(HttpClient client, string login)
    {
        var initialSession = await GetSessionAsync(client);
        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, Password),
            initialSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var session = await ReadJsonAsync<SessionPayload>(loginResponse);
        return session.CsrfToken;
    }

    private static async Task<SessionPayload> GetSessionAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/auth/session");
        return await ReadJsonAsync<SessionPayload>(response);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static void AssertOneSuccessAndOneConflict(
        HttpResponseMessage first,
        HttpResponseMessage second,
        HttpStatusCode successStatus)
    {
        var statuses = new[] { first.StatusCode, second.StatusCode };
        Assert.Contains(successStatus, statuses);
        Assert.Contains(HttpStatusCode.Conflict, statuses);
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private static GymCrmDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new GymCrmDbContext(options);
    }

    private sealed record SeededData(
        string ManagerLogin,
        Guid ManagerId,
        Guid CoachOneId,
        Guid CoachTwoId,
        Guid BranchId,
        Guid HallOneId,
        Guid HallTwoId,
        Guid GroupTypeId,
        Guid GroupOneId,
        Guid GroupTwoId);

    private sealed record TestContext(
        string ConnectionString,
        TestAppFactory Factory,
        SeededData Seeded,
        Action Release) : IAsyncDisposable
    {
        public HttpClient CreateClient()
        {
            return Factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });
        }

        public GymCrmDbContext CreateDbContext()
        {
            return GroupSchedulePostgreSqlConcurrencyTests.CreateDbContext(ConnectionString);
        }

        public async ValueTask DisposeAsync()
        {
            await Factory.DisposeAsync();
            Release();
        }
    }

    private sealed class TestAppFactory(
        string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = connectionString,
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "task119-pg-bootstrap",
                    ["BootstrapUser:FullName"] = "TASK-119 PostgreSQL Bootstrap"
                }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                services.AddDbContext<GymCrmDbContext>(options =>
                {
                    options.UseNpgsql(connectionString);
                });
            });
        }
    }

    public sealed class PostgreSqlFixture : IAsyncLifetime
    {
        private readonly SemaphoreSlim gate = new(1, 1);
        private PostgreSqlContainer postgreSql = null!;

        public string ConnectionString => postgreSql.GetConnectionString();

        public async Task InitializeAsync()
        {
            postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
                .WithDatabase($"gym_crm_task119_{Guid.NewGuid():N}")
                .WithUsername("gym_crm")
                .WithPassword("gym_crm")
                .Build();
            await postgreSql.StartAsync();
        }

        public async Task DisposeAsync()
        {
            gate.Dispose();
            await postgreSql.DisposeAsync();
        }

        public Task AcquireAsync() => gate.WaitAsync();

        public void Release() => gate.Release();
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken);
}
