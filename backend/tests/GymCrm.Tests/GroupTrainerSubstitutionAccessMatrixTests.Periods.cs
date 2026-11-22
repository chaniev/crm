using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GymCrm.Tests;

public partial class GroupTrainerSubstitutionAccessMatrixTests
{
    [Theory]
    [InlineData(9, 9, false, false)]
    [InlineData(10, 9, true, false)]
    [InlineData(10, 10, true, true)]
    [InlineData(12, 10, true, true)]
    [InlineData(12, 13, true, false)]
    [InlineData(15, 12, true, false)]
    [InlineData(15, 13, true, true)]
    [InlineData(16, 15, false, false)]
    public async Task Current_period_and_actual_lesson_date_control_both_surfaces(
        int today, int lessonDay, bool canRead, bool canWrite)
    {
        await using var factory = new SubstitutionAccessMatrixAppFactory(new DateOnly(2026, 12, 9));
        var seeded = await SeedAccessMatrixDataAsync(factory);
        var date = new DateOnly(2026, 12, lessonDay);
        var (lessonId, eveningId) = await AddPeriodMatrixLessonsAsync(factory, seeded, date);
        using var manager = factory.CreateClient();
        var managerSession = await LoginAsync(manager, "headcoach-access-matrix");
        using var staff = factory.CreateClient();
        var session = await LoginAsync(staff, "substitute-access-matrix");
        using var bot = factory.CreateClient();
        bot.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BotToken);
        var path = $"/groups/{seeded.MainGroupId}/trainer-substitution-periods";
        using var created = await PostJsonAsync(manager, path, new
        {
            substituteTrainerId = seeded.SubstituteCoachId,
            startsOn = "2026-12-10",
            endsOn = "2026-12-15"
        }, managerSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var periodId = (await ReadJsonElementAsync(created)).GetProperty("id").GetGuid();
        var clock = (FixedBusinessDateProvider)factory.Services.GetRequiredService<IBusinessDateProvider>();
        clock.Today = new DateOnly(2026, 12, today);

        var identity = $"platform=Telegram&platformUserId={seeded.SubstituteTelegramId}";
        var locator = $"/attendance/lessons/{lessonId}";
        var dateQuery = $"lessonDate={date:yyyy-MM-dd}";
        var staffRoster = $"{locator}/clients?{dateQuery}";
        var botRoster = $"/internal/bot{staffRoster}&{identity}";
        var clientPath = $"/clients/{seeded.MainClientId}";
        async Task CheckClientAccess(bool allowed)
        {
            foreach (var (http, prefix, query) in new[] { (staff, "", ""), (bot, "/internal/bot", $"?{identity}") })
            {
                using var card = await http.GetAsync(prefix + clientPath + query);
                using var photo = await http.GetAsync(prefix + clientPath + "/photo" + query);
                if (allowed)
                {
                    card.EnsureSuccessStatusCode();
                    var json = await ReadJsonElementAsync(card);
                    Assert.Equal(seeded.MainGroupId, Assert.Single(json.GetProperty("groups").EnumerateArray()).GetProperty("id").GetGuid());
                    Assert.DoesNotContain("+79990000001", json.GetRawText());
                    Assert.DoesNotContain("grossAmount", json.GetRawText());
                    Assert.True(!json.TryGetProperty("contacts", out var contacts) || contacts.ValueKind != JsonValueKind.Array || contacts.GetArrayLength() == 0);
                    photo.EnsureSuccessStatusCode();
                    Assert.Equal(new byte[] { 0xff, 0xd8, 0xff, 0xd9 }, await photo.Content.ReadAsByteArrayAsync());
                }
                else
                {
                    AssertForbiddenOrNotFound(card);
                    AssertForbiddenOrNotFound(photo);
                }
            }
        }
        async Task<HttpResponseMessage> StaffSave() => await PostJsonAsync(staff, $"{locator}?{dateQuery}", new
        {
            trainingDate = date,
            attendanceMarks = new[] { new { clientId = seeded.MainClientId, state = "Absent" } }
        }, session.CsrfToken);
        async Task<HttpResponseMessage> BotSave() => await SendBotRequestAsync(bot, HttpMethod.Post,
            $"/internal/bot{locator}?{dateQuery}", new BotSaveAttendanceRequest("Telegram", seeded.SubstituteTelegramId,
                date.ToString("yyyy-MM-dd"), [new BotAttendanceMarkRequest(seeded.MainClientId, true)]), "period-matrix-save");

        await CheckClientAccess(canRead);
        using var staffGroups = await staff.GetAsync("/attendance/groups");
        var groups = (await ReadJsonElementAsync(staffGroups)).GetProperty("groups").EnumerateArray().ToArray();
        Assert.Equal(canRead, groups.Any(g => g.GetProperty("id").GetGuid() == seeded.MainGroupId));
        Assert.Contains(groups, g => g.GetProperty("id").GetGuid() == seeded.PermanentGroupId);
        var staffSearch = await staff.GetFromJsonAsync<JsonElement>($"/clients?groupId={seeded.MainGroupId}");
        Assert.Equal(canRead, staffSearch.GetProperty("items").EnumerateArray().Any(c => c.GetProperty("id").GetGuid() == seeded.MainClientId));
        var foreignFilter = await staff.GetFromJsonAsync<JsonElement>($"/clients?groupId={seeded.UnrelatedGroupId}");
        Assert.Empty(foreignFilter.GetProperty("items").EnumerateArray());
        using var search = await bot.GetAsync($"/internal/bot/clients?q=Scoped&{identity}");
        var clients = (await ReadJsonElementAsync(search)).GetProperty("items").EnumerateArray();
        Assert.Equal(canRead, clients.Any(c => c.GetProperty("id").GetGuid() == seeded.MainClientId));
        using var roster = await staff.GetAsync(staffRoster);
        using var botRosterResponse = await bot.GetAsync(botRoster);
        using var detail = await staff.GetAsync($"/schedule/lessons/{lessonId}?{dateQuery}");
        var lessons = await bot.GetFromJsonAsync<JsonElement>($"/internal/bot/attendance/lessons?trainingDate={date:yyyy-MM-dd}&{identity}");
        if (canRead)
        {
            roster.EnsureSuccessStatusCode();
            botRosterResponse.EnsureSuccessStatusCode();
            detail.EnsureSuccessStatusCode();
            Assert.Equal(canWrite, (await ReadJsonElementAsync(detail)).GetProperty("allowedActions").GetProperty("editAttendance").GetProperty("allowed").GetBoolean());
            Assert.Equal(canWrite, (await ReadJsonElementAsync(botRosterResponse)).GetProperty("canEditAttendance").GetBoolean());
            Assert.Equal(canWrite, Assert.Single(lessons.EnumerateArray(), l => l.GetProperty("lessonOccurrenceId").GetGuid() == lessonId).GetProperty("canEditAttendance").GetBoolean());
        }
        else
        {
            AssertForbiddenOrNotFound(roster);
            AssertForbiddenOrNotFound(botRosterResponse);
            AssertForbiddenOrNotFound(detail);
            Assert.Equal(eveningId, Assert.Single(lessons.EnumerateArray()).GetProperty("lessonOccurrenceId").GetGuid());
        }
        using var staffSave = await StaffSave();
        using var botSave = await BotSave();
        Assert.Equal(canWrite, staffSave.IsSuccessStatusCode);
        Assert.Equal(canWrite, botSave.IsSuccessStatusCode);
        if (!canWrite)
        {
            Assert.Contains(staffSave.StatusCode, new[] { HttpStatusCode.Forbidden, HttpStatusCode.NotFound, HttpStatusCode.BadRequest });
            Assert.Contains(botSave.StatusCode, new[] { HttpStatusCode.Forbidden, HttpStatusCode.NotFound, HttpStatusCode.BadRequest });
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(canWrite, await db.Attendance.AnyAsync(a => a.LessonOccurrenceId == lessonId && a.IsPresent));
        Assert.Equal(canWrite, await db.ClientMemberships.AnyAsync(m => m.ClientId == seeded.MainClientId && m.SingleVisitUsed));
        if (!canRead) return;

        using var cancel = await PostWithoutBodyAsync(manager, $"{path}/{periodId}/cancel", managerSession.CsrfToken);
        cancel.EnsureSuccessStatusCode();
        var auditCount = await db.AuditLogs.CountAsync();
        var markCount = await db.Attendance.CountAsync();
        var memberships = await db.ClientMemberships.CountAsync();
        var reservations = await db.BotIdempotencyRecords.CountAsync();
        await CheckClientAccess(false);
        using var oldStaff = await StaffSave();
        using var oldBot = await BotSave();
        AssertForbiddenOrNotFound(oldStaff);
        AssertForbiddenOrNotFound(oldBot);
        Assert.Equal(markCount, await db.Attendance.CountAsync());
        Assert.Equal(memberships, await db.ClientMemberships.CountAsync());
        Assert.Equal(reservations, await db.BotIdempotencyRecords.CountAsync());
        Assert.Equal(auditCount, await db.AuditLogs.CountAsync());
        using var permanent = await staff.GetAsync($"/clients/{seeded.PermanentClientId}");
        permanent.EnsureSuccessStatusCode();

        // Independent access to the evening lesson survives withdrawal of the group period.
        var evening = $"/attendance/lessons/{eveningId}";
        using var eveningRoster = await staff.GetAsync($"{evening}/clients?{dateQuery}");
        eveningRoster.EnsureSuccessStatusCode();
        using var eveningBotRoster = await bot.GetAsync($"/internal/bot{evening}/clients?{dateQuery}&{identity}");
        eveningBotRoster.EnsureSuccessStatusCode();
        if (today == 10 && lessonDay == 9)
        {
            using var eveningSave = await PostJsonAsync(staff, $"{evening}?{dateQuery}", new
            {
                attendanceMarks = new[] { new { clientId = seeded.MainClientId, state = "Absent" } }
            }, session.CsrfToken);
            eveningSave.EnsureSuccessStatusCode();
            using var eveningBotSave = await SendBotRequestAsync(bot, HttpMethod.Post, $"/internal/bot{evening}?{dateQuery}",
                new BotSaveAttendanceRequest("Telegram", seeded.SubstituteTelegramId, date.ToString("yyyy-MM-dd"),
                    [new BotAttendanceMarkRequest(seeded.MainClientId, true)]), "evening-only");
            eveningBotSave.EnsureSuccessStatusCode();
        }
    }

    private static async Task<(Guid Morning, Guid Evening)> AddPeriodMatrixLessonsAsync(SubstitutionAccessMatrixAppFactory factory,
        SeededAccessMatrixData seeded, DateOnly date)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var group = await db.TrainingGroups.SingleAsync(g => g.Id == seeded.MainGroupId);
        db.ClientGroups.Add(new ClientGroup { ClientId = seeded.MainClientId, GroupId = seeded.UnrelatedGroupId, BranchId = group.BranchId });
        var lesson = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            HallId = group.HallId,
            SourceKind = LessonOccurrenceSourceKind.OneOff,
            LessonDate = date,
            StartTime = new TimeOnly(10, 0),
            DurationMinutes = 60
        };
        var legacy = await db.GroupTrainerSubstitutions.SingleAsync();
        legacy.StartsOn = new DateOnly(2026, 12, 8);
        legacy.EndsOn = new DateOnly(2026, 12, 18);
        var evening = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            HallId = group.HallId,
            LessonDate = date,
            SourceKind = LessonOccurrenceSourceKind.OneOff,
            StartTime = new TimeOnly(18, 0),
            DurationMinutes = 60
        };
        evening.TrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            ReplacedTrainerId = seeded.HeadCoachId,
            SubstituteTrainerId = seeded.SubstituteCoachId,
            CreatedByUserId = seeded.HeadCoachId
        });
        db.LessonOccurrences.Add(evening);
        // The morning slot on the 9th is a recurring lesson moved from inside the period.
        // On the 10th it is an unmaterialized recurring lesson.
        if (date.Day is 9 or 10)
        {
            var projectedDate = new DateOnly(2026, 12, 10);
            var slot = new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                SlotLineageId = Guid.NewGuid(),
                IsoWeekday = (int)projectedDate.DayOfWeek,
                HallId = group.HallId,
                StartTime = lesson.StartTime,
                DurationMinutes = 60
            };
            var version = new LessonScheduleRuleVersion { Id = Guid.NewGuid(), EffectiveFrom = projectedDate, VersionNumber = 1, Slots = [slot] };
            var series = new LessonSeries { Id = Guid.NewGuid(), GroupId = group.Id, StartsOn = projectedDate, RuleVersions = [version] };
            db.LessonSeries.Add(series);
            lesson.Id = LessonOccurrenceIdPolicy.CreateRecurring(slot.SlotLineageId, projectedDate);
            if (date != projectedDate)
            {
                lesson.SourceKind = LessonOccurrenceSourceKind.Recurring;
                lesson.ProjectedDate = projectedDate;
                lesson.SourceLessonSeriesId = series.Id;
                lesson.SourceRuleVersionId = version.Id;
                lesson.SourceSlotId = slot.Id;
                lesson.SourceSlotLineageId = slot.SlotLineageId;
                db.LessonOccurrences.Add(lesson);
            }
        }
        else
        {
            db.LessonOccurrences.Add(lesson);
        }
        await AttendanceApiTests.AddMembershipAsync(db, seeded.MainClientId, seeded.HeadCoachId, MembershipBehaviorKind.SingleVisit,
            group.Id, group.BranchId, new DateOnly(2026, 12, 1), null, 1200m, false);
        await db.SaveChangesAsync();
        return (lesson.Id, evening.Id);
    }
}
