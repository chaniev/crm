using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public sealed partial class ScheduleLessonsApiTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task One_off_is_visible_before_series_start_or_without_series(bool hasSeries)
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        var calendar = await SeedBotCalendarAsync(factory, seeded);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            if (hasSeries)
            {
                var series = await db.LessonSeries.SingleAsync(item => item.Id == seeded.SeriesId);
                series.StartsOn = new DateOnly(2026, 8, 19);
            }
            else
            {
                var original = await db.TrainingGroups.SingleAsync(item => item.Id == seeded.GroupId);
                var standalone = new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    Name = "Standalone",
                    BranchId = original.BranchId,
                    HallId = original.HallId,
                    GroupTypeId = original.GroupTypeId,
                    TrainingStartTime = original.TrainingStartTime,
                    DurationMinutes = original.DurationMinutes,
                    Weekdays = [1],
                    IsActive = true,
                    CreatedAt = original.CreatedAt,
                    UpdatedAt = original.UpdatedAt
                };
                db.TrainingGroups.Add(standalone);
                var oneOff = await db.LessonOccurrences.SingleAsync(item => item.Id == calendar.CancelledId);
                oneOff.GroupId = standalone.Id;
            }
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        using var response = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-17&platform=Telegram&platformUserId=schedule-headcoach");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains((await ReadJsonElementAsync(response)).EnumerateArray(),
            item => item.GetProperty("lessonOccurrenceId").GetGuid() == calendar.CancelledId);
    }

    [Fact]
    public async Task Actual_one_off_and_moved_lessons_remain_visible_beyond_series_end_with_scope_and_filters()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        var calendar = await SeedBotCalendarAsync(factory, seeded);
        Guid actualHallId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var series = await db.LessonSeries.SingleAsync(item => item.Id == seeded.SeriesId);
            series.EndsOn = new DateOnly(2026, 8, 17);
            var oneOff = await db.LessonOccurrences.SingleAsync(item => item.Id == calendar.CancelledId);
            oneOff.LessonDate = new DateOnly(2026, 8, 18);
            actualHallId = oneOff.HallId;
            var outsider = await db.Users.SingleAsync(item => item.Id == seeded.TrainerId);
            outsider.MessengerPlatform = MessengerPlatform.Telegram;
            outsider.MessengerPlatformUserId = "schedule-outsider";
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        _ = await LoginAsync(client, seeded.Login, seeded.Password);
        using var webResponse = await client.GetAsync("/schedule/lessons?from=2026-08-18&to=2026-08-18");
        using var botResponse = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-18&platform=Telegram&platformUserId=schedule-headcoach");
        var expected = new[] { seeded.MorningOccurrenceId, calendar.CancelledId };
        Assert.Equal(HttpStatusCode.OK, webResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, botResponse.StatusCode);
        Assert.Equal(expected, (await ReadJsonElementAsync(webResponse)).GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("lessonOccurrenceId").GetGuid()));
        Assert.Equal(expected, (await ReadJsonElementAsync(botResponse)).EnumerateArray()
            .Select(item => item.GetProperty("lessonOccurrenceId").GetGuid()));
        using var actualRoster = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            $"/internal/bot/attendance/lessons/{seeded.MorningOccurrenceId}/clients?lessonDate=2026-08-18&platform=Telegram&platformUserId=schedule-headcoach");
        Assert.Equal(HttpStatusCode.OK, actualRoster.StatusCode);
        using var outsiderResponse = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-18&platform=Telegram&platformUserId=schedule-outsider");
        Assert.Empty((await ReadJsonElementAsync(outsiderResponse)).EnumerateArray());

        foreach (var filter in new[] { $"groupId={Guid.NewGuid()}", $"branchId={Guid.NewGuid()}", $"groupTypeId={Guid.NewGuid()}", $"hallId={seeded.HallId}" })
        {
            using var filtered = await client.GetAsync($"/schedule/lessons?from=2026-08-18&to=2026-08-18&{filter}");
            Assert.Empty((await ReadJsonElementAsync(filtered)).GetProperty("items").EnumerateArray());
        }
        using var matchingHall = await client.GetAsync($"/schedule/lessons?from=2026-08-18&to=2026-08-18&hallId={actualHallId}");
        Assert.Equal(2, (await ReadJsonElementAsync(matchingHall)).GetProperty("items").GetArrayLength());
        // A group with an overlapping series must retain its existing series-based hall filter.
        using var existingSeriesFilter = await client.GetAsync($"/schedule/lessons?from=2026-08-17&to=2026-08-18&hallId={actualHallId}");
        Assert.Empty((await ReadJsonElementAsync(existingSeriesFilter)).GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Bot_recurring_list_keeps_distinct_same_day_ids_date_policy_and_does_not_materialize()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var coach = await db.Users.SingleAsync(item => item.Id == seeded.TrainerId);
            coach.MessengerPlatform = MessengerPlatform.Telegram;
            coach.MessengerPlatformUserId = "schedule-coach";
            db.GroupTrainers.Add(new GroupTrainer { GroupId = seeded.GroupId, TrainerId = coach.Id });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        using var botResponse = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-17&platform=Telegram&platformUserId=schedule-coach");
        Assert.Equal(HttpStatusCode.OK, botResponse.StatusCode);
        var items = (await ReadJsonElementAsync(botResponse)).EnumerateArray().ToArray();
        Assert.Equal(new[] { seeded.MorningOccurrenceId, seeded.EveningOccurrenceId },
            items.Select(item => item.GetProperty("lessonOccurrenceId").GetGuid()));
        Assert.All(items, item => Assert.False(item.GetProperty("canEditAttendance").GetBoolean()));

        _ = await LoginAsync(client, "schedule-coach", seeded.Password);
        using var webResponse = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, webResponse.StatusCode);
        Assert.All((await ReadJsonElementAsync(webResponse)).GetProperty("items").EnumerateArray(), item =>
        {
            var actions = item.GetProperty("allowedActions");
            Assert.Equal("lesson-not-cancelled", actions.GetProperty("restore").GetProperty("reason").GetString());
            Assert.Equal("no-active-substitution", actions.GetProperty("cancelTrainerSubstitution").GetProperty("reason").GetString());
        });
        using var finalScope = factory.Services.CreateScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await finalDb.LessonOccurrences.ToArrayAsync());
        Assert.Empty(await finalDb.Attendance.ToArrayAsync());
    }

    [Theory]
    [InlineData("assigned", 2)]
    [InlineData("substitute", 1)]
    [InlineData("outsider", 0)]
    [InlineData("administrator-without-grant", 0)]
    [InlineData("administrator-with-grant", 2)]
    public async Task Bot_actual_list_keeps_group_and_exact_substitution_scope(string access, int expectedCount)
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        _ = await SeedBotCalendarAsync(factory, seeded);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var actor = await db.Users.SingleAsync(item => item.Id ==
                (access == "substitute" ? seeded.SubstituteTrainerId : seeded.TrainerId));
            actor.MessengerPlatform = MessengerPlatform.Telegram;
            actor.MessengerPlatformUserId = "schedule-scope";
            if (access == "assigned")
                db.GroupTrainers.Add(new GroupTrainer { GroupId = seeded.GroupId, TrainerId = actor.Id });
            if (access.StartsWith("administrator", StringComparison.Ordinal))
            {
                actor.Role = UserRole.Administrator;
                if (access == "administrator-with-grant")
                    db.AdministratorAttendanceGroupGrants.Add(new AdministratorAttendanceGroupGrant
                    {
                        AdministratorId = actor.Id,
                        GroupId = seeded.GroupId,
                        BranchId = actor.BranchId!.Value,
                        GrantedByUserId = seeded.UserId,
                        GrantedAt = DateTimeOffset.UtcNow
                    });
            }
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        using var response = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-17&platform=Telegram&platformUserId=schedule-scope");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = (await ReadJsonElementAsync(response)).EnumerateArray().ToArray();
        Assert.Equal(expectedCount, items.Length);
        if (access == "substitute")
        {
            Assert.Equal(seeded.EveningOccurrenceId, Assert.Single(items).GetProperty("lessonOccurrenceId").GetGuid());
            using var inaccessibleRoster = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
                $"/internal/bot/attendance/lessons/{seeded.MorningOccurrenceId}/clients?lessonDate=2026-08-18&platform=Telegram&platformUserId=schedule-scope");
            Assert.Equal(HttpStatusCode.NotFound, inaccessibleRoster.StatusCode);
        }
    }

    [Fact]
    public async Task Bot_calendar_uses_same_actual_occurrences_as_web_without_writes()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        var calendar = await SeedBotCalendarAsync(factory, seeded);
        var cancelledId = calendar.CancelledId;
        using var client = factory.CreateClient();
        _ = await LoginAsync(client, seeded.Login, seeded.Password);
        int auditCount;
        using (var baselineScope = factory.Services.CreateScope())
            auditCount = await baselineScope.ServiceProvider.GetRequiredService<GymCrmDbContext>().AuditLogs.CountAsync();

        foreach (var date in new[] { "2026-08-17", "2026-08-18" })
        {
            using var webResponse = await client.GetAsync($"/schedule/lessons?from={date}&to={date}");
            using var botResponse = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
                $"/internal/bot/attendance/lessons?trainingDate={date}&platform=Telegram&platformUserId=schedule-headcoach");
            Assert.Equal(HttpStatusCode.OK, webResponse.StatusCode);
            Assert.Equal(HttpStatusCode.OK, botResponse.StatusCode);
            var webItems = (await ReadJsonElementAsync(webResponse)).GetProperty("items").EnumerateArray().ToArray();
            var botItems = (await ReadJsonElementAsync(botResponse)).EnumerateArray().ToArray();
            Assert.Equal(webItems.Select(item => item.GetProperty("lessonOccurrenceId").GetGuid()),
                botItems.Select(item => item.GetProperty("lessonOccurrenceId").GetGuid()));
            foreach (var (web, bot) in webItems.Zip(botItems))
            {
                foreach (var field in new[] { "lessonDate", "startTime", "groupName", "hallName", "branchName", "status" })
                    Assert.Equal(web.GetProperty(field).GetString(), bot.GetProperty(field).GetString());
                Assert.Equal(web.GetProperty("durationMinutes").GetInt32(), bot.GetProperty("durationMinutes").GetInt32());
                Assert.Equal(web.GetProperty("effectiveTrainers").EnumerateArray().Select(item => item.GetProperty("fullName").GetString()),
                    bot.GetProperty("effectiveTrainers").EnumerateArray().Select(item => item.GetString()));
                Assert.True(bot.GetProperty("canViewAttendance").GetBoolean());
                Assert.Equal(web.GetProperty("allowedActions").GetProperty("editAttendance").GetProperty("allowed").GetBoolean(),
                    bot.GetProperty("canEditAttendance").GetBoolean());
            }
            if (date == "2026-08-17")
            {
                Assert.DoesNotContain(botItems, item => item.GetProperty("lessonOccurrenceId").GetGuid() == seeded.MorningOccurrenceId);
                var cancelled = Assert.Single(botItems, item => item.GetProperty("lessonOccurrenceId").GetGuid() == cancelledId);
                Assert.False(cancelled.GetProperty("canEditAttendance").GetBoolean());
                Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());
            }
            else Assert.Equal(seeded.MorningOccurrenceId, Assert.Single(botItems).GetProperty("lessonOccurrenceId").GetGuid());
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(3, await db.LessonOccurrences.CountAsync());
        Assert.Empty(await db.Attendance.ToArrayAsync());
        Assert.Equal(auditCount, await db.AuditLogs.CountAsync());
        Assert.Empty(await db.BotIdempotencyRecords.ToArrayAsync());
        var restored = await db.LessonOccurrences.SingleAsync(item => item.Id == cancelledId);
        restored.Status = LessonOccurrenceStatus.Scheduled;
        await db.SaveChangesAsync();
        using var restoredResponse = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            "/internal/bot/attendance/lessons?trainingDate=2026-08-17&platform=Telegram&platformUserId=schedule-headcoach");
        var restoredItem = Assert.Single((await ReadJsonElementAsync(restoredResponse)).EnumerateArray(),
            item => item.GetProperty("lessonOccurrenceId").GetGuid() == cancelledId);
        Assert.True(restoredItem.GetProperty("canEditAttendance").GetBoolean());
    }

    [Fact]
    public async Task Bot_moved_occurrence_rejects_old_roster_locator_and_keeps_actual_locator()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        _ = await SeedBotCalendarAsync(factory, seeded);
        using var client = factory.CreateClient();

        using var oldRoster = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            $"/internal/bot/attendance/lessons/{seeded.MorningOccurrenceId}/clients?lessonDate=2026-08-17&platform=Telegram&platformUserId=schedule-headcoach");
        Assert.Equal(HttpStatusCode.NotFound, oldRoster.StatusCode);
        using var actualRoster = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
            $"/internal/bot/attendance/lessons/{seeded.MorningOccurrenceId}/clients?lessonDate=2026-08-18&platform=Telegram&platformUserId=schedule-headcoach");
        Assert.Equal(HttpStatusCode.OK, actualRoster.StatusCode);
    }

    [Theory]
    [InlineData(false, HttpStatusCode.NotFound)]
    [InlineData(true, HttpStatusCode.BadRequest)]
    public async Task Bot_stale_save_after_move_or_cancellation_does_not_write(bool cancelled, HttpStatusCode expectedStatus)
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        var calendar = await SeedBotCalendarAsync(factory, seeded);
        var cancelledId = calendar.CancelledId;
        using var client = factory.CreateClient();
        var occurrenceId = cancelled ? cancelledId : seeded.MorningOccurrenceId;
        if (cancelled)
        {
            using var roster = await SendScheduleBotRequestAsync(client, HttpMethod.Get,
                $"/internal/bot/attendance/lessons/{cancelledId}/clients?lessonDate=2026-08-17&platform=Telegram&platformUserId=schedule-headcoach");
            Assert.Equal(HttpStatusCode.OK, roster.StatusCode);
        }
        using var response = await SendScheduleBotRequestAsync(client, HttpMethod.Post,
            $"/internal/bot/attendance/lessons/{occurrenceId}?lessonDate=2026-08-17", new
            {
                platform = "Telegram",
                platformUserId = "schedule-headcoach",
                trainingDate = "2026-08-17",
                attendanceMarks = new[] { new { clientId = calendar.ClientId, isPresent = true } }
            });
        Assert.Equal(expectedStatus, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Empty(await db.Attendance.ToArrayAsync());
        Assert.Empty(await db.AuditLogs.ToArrayAsync());
        Assert.Empty(await db.BotIdempotencyRecords.ToArrayAsync());
        Assert.Equal(3, await db.LessonOccurrences.CountAsync());
    }

    private static async Task<(Guid CancelledId, Guid ClientId)> SeedBotCalendarAsync(ScheduleLessonsAppFactory factory, SeededSchedule seeded)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var user = await db.Users.SingleAsync(item => item.Id == seeded.UserId);
        user.MessengerPlatform = MessengerPlatform.Telegram;
        user.MessengerPlatformUserId = "schedule-headcoach";
        var group = await db.TrainingGroups.SingleAsync(item => item.Id == seeded.GroupId);
        var now = new DateTimeOffset(2026, 8, 16, 10, 0, 0, TimeSpan.Zero);
        var hall = new Hall { Id = Guid.NewGuid(), BranchId = group.BranchId, Name = "Actual Hall", CreatedAt = now, UpdatedAt = now };
        var moved = new LessonOccurrence
        {
            Id = seeded.MorningOccurrenceId,
            GroupId = seeded.GroupId,
            HallId = hall.Id,
            LessonDate = new DateOnly(2026, 8, 18),
            ProjectedDate = new DateOnly(2026, 8, 17),
            StartTime = new TimeOnly(11, 0),
            DurationMinutes = 80,
            SourceLessonSeriesId = seeded.SeriesId,
            SourceRuleVersionId = seeded.RuleVersionId,
            SourceSlotId = seeded.MorningSlotId,
            SourceSlotLineageId = seeded.MorningSlotLineageId,
            SourceKind = LessonOccurrenceSourceKind.Recurring,
            CreatedAt = now,
            UpdatedAt = now
        };
        var evening = new LessonOccurrence
        {
            Id = seeded.EveningOccurrenceId,
            GroupId = seeded.GroupId,
            HallId = hall.Id,
            LessonDate = new DateOnly(2026, 8, 17),
            ProjectedDate = new DateOnly(2026, 8, 17),
            StartTime = new TimeOnly(19, 0),
            DurationMinutes = 90,
            SourceLessonSeriesId = seeded.SeriesId,
            SourceKind = LessonOccurrenceSourceKind.Recurring,
            CreatedAt = now,
            UpdatedAt = now
        };
        var cancelled = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = seeded.GroupId,
            HallId = hall.Id,
            LessonDate = new DateOnly(2026, 8, 17),
            StartTime = new TimeOnly(14, 0),
            DurationMinutes = 45,
            Status = LessonOccurrenceStatus.Cancelled,
            SourceKind = LessonOccurrenceSourceKind.OneOff,
            CreatedAt = now,
            UpdatedAt = now
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = group.BranchId,
            FirstName = "Calendar",
            LastName = "Client",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.AddRange(client, new ClientGroup { ClientId = client.Id, GroupId = group.Id, BranchId = group.BranchId },
            hall, moved, evening, cancelled, new LessonOccurrenceTrainerSubstitution
            {
                Id = Guid.NewGuid(),
                LessonOccurrenceId = evening.Id,
                ReplacedTrainerId = seeded.TrainerId,
                SubstituteTrainerId = seeded.SubstituteTrainerId,
                CreatedAt = now,
                CreatedByUserId = seeded.UserId
            });
        await db.SaveChangesAsync();
        return (cancelled.Id, client.Id);
    }

    private static async Task<HttpResponseMessage> SendScheduleBotRequestAsync(HttpClient client, HttpMethod method, string uri, object? body = null)
    {
        using var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "schedule-bot-test-token");
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
        }
        return await client.SendAsync(request);
    }
}
