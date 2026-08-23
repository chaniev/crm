using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
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

namespace GymCrm.Tests;

public sealed class ScheduleLessonsApiTests
{
    [Fact]
    public async Task Calendar_read_projects_same_day_slots_with_distinct_slot_lineage_ids_without_writes()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.Login, seeded.Password);

        using var response = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var createOneOff = payload.GetProperty("capabilities").GetProperty("createOneOff");
        Assert.True(createOneOff.GetProperty("allowed").GetBoolean());
        Assert.Equal(JsonValueKind.Null, createOneOff.GetProperty("reason").ValueKind);

        var items = payload.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal(2, items.Length);
        Assert.Equal(new[] { "10:00", "18:30" }, items.Select(item => item.GetProperty("startTime").GetString()).ToArray());
        Assert.Equal(
            new[]
            {
                seeded.MorningOccurrenceId,
                seeded.EveningOccurrenceId
            },
            items.Select(item => Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!)).ToArray());
        Assert.All(items, item =>
        {
            Assert.Equal("Recurring", item.GetProperty("sourceKind").GetString());
            Assert.False(item.GetProperty("isMaterialized").GetBoolean());
            Assert.Equal("2026-08-17", item.GetProperty("lessonDate").GetString());
            Assert.NotEqual(string.Empty, item.GetProperty("revision").GetString());
            var allowedActions = item.GetProperty("allowedActions");
            Assert.True(allowedActions.GetProperty("edit").GetProperty("allowed").GetBoolean());
            Assert.True(allowedActions.GetProperty("move").GetProperty("allowed").GetBoolean());
            Assert.True(allowedActions.GetProperty("cancel").GetProperty("allowed").GetBoolean());
            Assert.True(allowedActions.GetProperty("assignTrainerSubstitution").GetProperty("allowed").GetBoolean());
            Assert.Equal(seeded.SeriesId, Guid.Parse(item.GetProperty("lessonSeriesId").GetString()!));
        });

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync());
    }

    [Fact]
    public async Task Calendar_attendance_fact_is_keyed_by_occurrence_not_group_date()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.Attendance.Add(new GymCrm.Domain.Attendance.Attendance
            {
                Id = Guid.NewGuid(),
                ClientId = Guid.NewGuid(),
                GroupId = seeded.GroupId,
                LessonOccurrenceId = seeded.MorningOccurrenceId,
                TrainingDate = new DateOnly(2026, 8, 17),
                IsPresent = true,
                MarkedByUserId = seeded.UserId,
                MarkedAt = new DateTimeOffset(2026, 8, 17, 10, 0, 0, TimeSpan.Zero),
                UpdatedAt = new DateTimeOffset(2026, 8, 17, 10, 0, 0, TimeSpan.Zero)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.Login, seeded.Password);

        using var response = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = (await ReadJsonElementAsync(response)).GetProperty("items").EnumerateArray().ToArray();
        Assert.True(items.Single(item =>
            Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!) == seeded.MorningOccurrenceId).GetProperty("hasAttendanceMarks").GetBoolean());
        Assert.False(items.Single(item =>
            Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!) == seeded.EveningOccurrenceId).GetProperty("hasAttendanceMarks").GetBoolean());
    }

    [Fact]
    public async Task Lesson_series_read_returns_reload_safe_current_slots_revision_and_supports_series_id_lookup()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.Login, seeded.Password);

        using var byGroupResponse = await client.GetAsync($"/groups/{seeded.GroupId}/lesson-series");
        Assert.Equal(HttpStatusCode.OK, byGroupResponse.StatusCode);
        var byGroup = await ReadJsonElementAsync(byGroupResponse);
        Assert.Equal(seeded.SeriesId, Guid.Parse(byGroup.GetProperty("seriesId").GetString()!));
        Assert.Equal(seeded.GroupId, Guid.Parse(byGroup.GetProperty("groupId").GetString()!));
        Assert.Equal("Two Slots", byGroup.GetProperty("groupName").GetString());
        Assert.Equal("2026-08-01", byGroup.GetProperty("startsOn").GetString());
        Assert.Equal(JsonValueKind.Null, byGroup.GetProperty("endsOn").ValueKind);
        Assert.False(string.IsNullOrWhiteSpace(byGroup.GetProperty("revision").GetString()));

        var currentVersion = byGroup.GetProperty("currentVersion");
        Assert.Equal(1, currentVersion.GetProperty("versionNumber").GetInt32());
        Assert.Equal("2026-08-01", currentVersion.GetProperty("effectiveFrom").GetString());
        Assert.Equal(JsonValueKind.Null, currentVersion.GetProperty("effectiveTo").ValueKind);
        var businessDate = DateOnly.Parse(byGroup.GetProperty("businessDate").GetString()!, CultureInfo.InvariantCulture);
        var expectedEditDate = businessDate >= new DateOnly(2026, 8, 1)
            ? businessDate
            : new DateOnly(2026, 8, 1);
        Assert.Equal(
            expectedEditDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            currentVersion.GetProperty("thisAndFutureMinEffectiveFrom").GetString());
        Assert.Equal(
            expectedEditDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            currentVersion.GetProperty("entireSeriesEffectiveFrom").GetString());
        var slots = currentVersion.GetProperty("slots").EnumerateArray().ToArray();
        Assert.Equal(new[] { "10:00", "18:30" }, slots.Select(slot => slot.GetProperty("startTime").GetString()).ToArray());
        Assert.All(slots, slot =>
        {
            Assert.Equal(seeded.HallId, Guid.Parse(slot.GetProperty("hallId").GetString()!));
            Assert.Equal("Main Hall", slot.GetProperty("hallName").GetString());
            Assert.False(slot.TryGetProperty("id", out _));
            Assert.False(slot.TryGetProperty("ruleVersionId", out _));
            Assert.False(slot.TryGetProperty("slotLineageId", out _));
            Assert.False(slot.TryGetProperty("trainerIds", out _));
        });

        using var bySeriesResponse = await client.GetAsync($"/groups/{seeded.SeriesId}/lesson-series");
        Assert.Equal(HttpStatusCode.OK, bySeriesResponse.StatusCode);
        var bySeries = await ReadJsonElementAsync(bySeriesResponse);
        Assert.Equal(byGroup.GetProperty("revision").GetString(), bySeries.GetProperty("revision").GetString());
        Assert.Equal(seeded.GroupId, Guid.Parse(bySeries.GetProperty("groupId").GetString()!));
        Assert.Equal(2, bySeries.GetProperty("currentVersion").GetProperty("slots").GetArrayLength());
    }

    [Fact]
    public async Task Lesson_series_read_enforces_group_management_scope()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.SubstituteLogin, seeded.Password);

        using var response = await client.GetAsync($"/groups/{seeded.GroupId}/lesson-series");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Lesson_trainer_substitution_execute_materializes_exact_occurrence_and_filters_by_effective_trainer()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);

        using var legacyMutationResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupId}/trainer-substitutions/",
            new
            {
                substituteTrainerId = seeded.SubstituteTrainerId,
                startsOn = "2026-08-17",
                endsOn = "2026-08-17"
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, legacyMutationResponse.StatusCode);

        using var detailResponse = await client.GetAsync($"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        var previewRequest = new
        {
            replacedTrainerId = seeded.TrainerId,
            substituteTrainerId = seeded.SubstituteTrainerId,
            targets = new[]
            {
                new
                {
                    lessonOccurrenceId = seeded.MorningOccurrenceId,
                    lessonDate = "2026-08-17",
                    expectedRevision = revision
                }
            }
        };
        using var previewResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions/preview",
            previewRequest,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));

        using var executeResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions",
            new
            {
                previewRequest.replacedTrainerId,
                previewRequest.substituteTrainerId,
                previewRequest.targets,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        var executedLesson = (await ReadJsonElementAsync(executeResponse)).GetProperty("lessons").EnumerateArray().Single();
        var effectiveTrainers = executedLesson.GetProperty("effectiveTrainers").EnumerateArray().ToArray();
        var substitute = Assert.Single(effectiveTrainers);
        Assert.Equal(seeded.SubstituteTrainerId, Guid.Parse(substitute.GetProperty("trainerId").GetString()!));
        Assert.Equal("Substitute", substitute.GetProperty("kind").GetString());
        Assert.Equal(seeded.TrainerId, Guid.Parse(substitute.GetProperty("replacedTrainerId").GetString()!));
        Assert.True(executedLesson.GetProperty("allowedActions").GetProperty("cancelTrainerSubstitution").GetProperty("allowed").GetBoolean());

        using var calendarResponse = await client.GetAsync($"/schedule/lessons?from=2026-08-17&to=2026-08-17&trainerId={seeded.SubstituteTrainerId}");
        Assert.Equal(HttpStatusCode.OK, calendarResponse.StatusCode);
        var calendarItems = (await ReadJsonElementAsync(calendarResponse)).GetProperty("items").EnumerateArray().ToArray();
        var item = Assert.Single(calendarItems);
        Assert.Equal(seeded.MorningOccurrenceId, Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(1, await dbContext.LessonOccurrences.CountAsync(occurrence => occurrence.Id == seeded.MorningOccurrenceId));
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync(occurrence => occurrence.Id == seeded.EveningOccurrenceId));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == "LessonOccurrenceTrainerSubstitutionCreated" &&
            log.EntityType == "LessonOccurrenceTrainerSubstitution"));
    }

    [Fact]
    public async Task Lesson_trainer_substitution_cancellation_removes_effective_substitute_marker()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        var revision = (await ReadJsonElementAsync(await client.GetAsync($"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17")))
            .GetProperty("revision")
            .GetString();
        using var previewResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions/preview",
            new
            {
                replacedTrainerId = seeded.TrainerId,
                substituteTrainerId = seeded.SubstituteTrainerId,
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        expectedRevision = revision
                    }
                }
            },
            session.CsrfToken);
        var token = (await ReadJsonElementAsync(previewResponse)).GetProperty("confirmationToken").GetString();
        using var executeResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions",
            new
            {
                replacedTrainerId = seeded.TrainerId,
                substituteTrainerId = seeded.SubstituteTrainerId,
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        expectedRevision = revision
                    }
                },
                confirmationToken = token
            },
            session.CsrfToken);
        var executedLesson = (await ReadJsonElementAsync(executeResponse)).GetProperty("lessons").EnumerateArray().Single();
        var substitutionId = Guid.Parse(executedLesson
            .GetProperty("effectiveTrainers")
            .EnumerateArray()
            .Single()
            .GetProperty("substitutionId")
            .GetString()!);
        var updatedRevision = executedLesson.GetProperty("revision").GetString();

        using var cancelPreviewResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions/cancellations/preview",
            new
            {
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        substitutionId,
                        expectedRevision = updatedRevision
                    }
                },
                reason = "Coach returned"
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, cancelPreviewResponse.StatusCode);
        var cancelToken = (await ReadJsonElementAsync(cancelPreviewResponse)).GetProperty("confirmationToken").GetString();

        using var cancelResponse = await PostJsonAsync(
            client,
            "/schedule/lesson-trainer-substitutions/cancellations",
            new
            {
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        substitutionId,
                        expectedRevision = updatedRevision
                    }
                },
                reason = "Coach returned",
                confirmationToken = cancelToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
        var cancelledLesson = (await ReadJsonElementAsync(cancelResponse)).GetProperty("lessons").EnumerateArray().Single();
        var trainer = Assert.Single(cancelledLesson.GetProperty("effectiveTrainers").EnumerateArray());
        Assert.Equal(seeded.TrainerId, Guid.Parse(trainer.GetProperty("trainerId").GetString()!));
        Assert.Equal("Permanent", trainer.GetProperty("kind").GetString());
        Assert.False(cancelledLesson.GetProperty("allowedActions").GetProperty("cancelTrainerSubstitution").GetProperty("allowed").GetBoolean());
    }

    [Fact]
    public async Task Substitute_coach_can_access_only_exact_non_cancelled_occurrence_not_same_day_group_occurrence()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.Login, seeded.Password);
        var revision = (await ReadJsonElementAsync(await adminClient.GetAsync($"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17")))
            .GetProperty("revision")
            .GetString();
        using var previewResponse = await PostJsonAsync(
            adminClient,
            "/schedule/lesson-trainer-substitutions/preview",
            new
            {
                replacedTrainerId = seeded.TrainerId,
                substituteTrainerId = seeded.SubstituteTrainerId,
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        expectedRevision = revision
                    }
                }
            },
            adminSession.CsrfToken);
        var token = (await ReadJsonElementAsync(previewResponse)).GetProperty("confirmationToken").GetString();
        using var executeResponse = await PostJsonAsync(
            adminClient,
            "/schedule/lesson-trainer-substitutions",
            new
            {
                replacedTrainerId = seeded.TrainerId,
                substituteTrainerId = seeded.SubstituteTrainerId,
                targets = new[]
                {
                    new
                    {
                        lessonOccurrenceId = seeded.MorningOccurrenceId,
                        lessonDate = "2026-08-17",
                        expectedRevision = revision
                    }
                },
                confirmationToken = token
            },
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);

        using var substituteClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(substituteClient, seeded.SubstituteLogin, seeded.Password);

        using var calendarResponse = await substituteClient.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, calendarResponse.StatusCode);
        var calendarItems = (await ReadJsonElementAsync(calendarResponse)).GetProperty("items").EnumerateArray().ToArray();
        var item = Assert.Single(calendarItems);
        Assert.Equal(seeded.MorningOccurrenceId, Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!));

        using var morningDetail = await substituteClient.GetAsync($"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, morningDetail.StatusCode);
        using var eveningDetail = await substituteClient.GetAsync($"/schedule/lessons/{seeded.EveningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.NotFound, eveningDetail.StatusCode);

        using var morningRoster = await substituteClient.GetAsync($"/attendance/lessons/{seeded.MorningOccurrenceId}/clients?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, morningRoster.StatusCode);
        using var eveningRoster = await substituteClient.GetAsync($"/attendance/lessons/{seeded.EveningOccurrenceId}/clients?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.NotFound, eveningRoster.StatusCode);
    }

    [Fact]
    public async Task One_off_preview_execute_consumes_confirmation_token_and_audits_created_occurrence()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        var request = new
        {
            groupId = seeded.GroupId,
            lessonDate = "2026-08-18",
            startTime = "12:00",
            durationMinutes = 60,
            hallId = seeded.HallId
        };

        using var previewResponse = await PostJsonAsync(
            client,
            "/schedule/lessons/one-off/preview",
            request,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));
        var previewLesson = preview.GetProperty("lesson");
        Assert.Equal("OneOff", previewLesson.GetProperty("sourceKind").GetString());
        Assert.False(previewLesson.GetProperty("isMaterialized").GetBoolean());
        var previewOccurrenceId = Guid.Parse(previewLesson.GetProperty("lessonOccurrenceId").GetString()!);

        using var executeResponse = await PostJsonAsync(
            client,
            "/schedule/lessons/one-off",
            new
            {
                request.groupId,
                request.lessonDate,
                request.startTime,
                request.durationMinutes,
                request.hallId,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Created, executeResponse.StatusCode);
        var created = await ReadJsonElementAsync(executeResponse);
        Assert.Equal(previewOccurrenceId, Guid.Parse(created.GetProperty("lessonOccurrenceId").GetString()!));
        Assert.Equal("OneOff", created.GetProperty("sourceKind").GetString());
        Assert.True(created.GetProperty("isMaterialized").GetBoolean());

        using var replay = await PostJsonAsync(
            client,
            "/schedule/lessons/one-off",
            new
            {
                request.groupId,
                request.lessonDate,
                request.startTime,
                request.durationMinutes,
                request.hallId,
                confirmationToken
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
        var replayProblem = await ReadJsonElementAsync(replay);
        Assert.Equal(
            "lesson-mutation-preview-invalid",
            replayProblem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var occurrence = Assert.Single(await dbContext.LessonOccurrences.ToArrayAsync());
        Assert.Equal(previewOccurrenceId, occurrence.Id);
        Assert.Equal(LessonOccurrenceSourceKind.OneOff, occurrence.SourceKind);
        Assert.Equal(1, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == "LessonOccurrenceCreated" &&
            log.EntityType == "LessonOccurrence" &&
            log.EntityId == previewOccurrenceId.ToString()));
    }

    [Fact]
    public async Task One_off_preview_rejects_same_group_overlap_without_issuing_token()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);

        using var response = await PostJsonAsync(
            client,
            "/schedule/lessons/one-off/preview",
            new
            {
                groupId = seeded.GroupId,
                lessonDate = "2026-08-17",
                startTime = "10:30",
                durationMinutes = 30,
                hallId = seeded.HallId
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.True(problem.GetProperty("errors").TryGetProperty("startTime", out _));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.ScheduleMutationConfirmationTokens.CountAsync());
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync());
    }

    [Fact]
    public async Task Cancellation_preview_execute_consumes_token_and_restore_uses_new_preview()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);

        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();
        using var previewCancelResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation/preview?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = revision },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewCancelResponse.StatusCode);
        var previewCancel = await ReadJsonElementAsync(previewCancelResponse);
        Assert.Equal("Cancel", previewCancel.GetProperty("action").GetString());
        var cancelToken = previewCancel.GetProperty("confirmationToken").GetString();

        using var cancelResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = revision, confirmationToken = cancelToken },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
        var cancelled = await ReadJsonElementAsync(cancelResponse);
        Assert.Equal("Cancelled", cancelled.GetProperty("status").GetString());

        using var replayResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = revision, confirmationToken = cancelToken },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        Assert.Equal("lesson-mutation-preview-invalid", (await ReadJsonElementAsync(replayResponse)).GetProperty("code").GetString());

        var restoreRevision = cancelled.GetProperty("revision").GetString();
        using var previewRestoreResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation/preview?lessonDate=2026-08-17",
            new { action = "Restore", expectedRevision = restoreRevision },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, previewRestoreResponse.StatusCode);
        var restoreToken = (await ReadJsonElementAsync(previewRestoreResponse)).GetProperty("confirmationToken").GetString();

        using var restoreResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation?lessonDate=2026-08-17",
            new { action = "Restore", expectedRevision = restoreRevision, confirmationToken = restoreToken },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
        Assert.Equal("Scheduled", (await ReadJsonElementAsync(restoreResponse)).GetProperty("status").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(2, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "LessonOccurrenceCancelled"));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "LessonOccurrenceRestored"));
    }

    [Fact]
    public async Task Cancellation_conflict_is_occurrence_keyed_for_same_group_same_day_slots()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.Attendance.Add(new GymCrm.Domain.Attendance.Attendance
            {
                Id = Guid.NewGuid(),
                ClientId = Guid.NewGuid(),
                GroupId = seeded.GroupId,
                LessonOccurrenceId = seeded.MorningOccurrenceId,
                TrainingDate = new DateOnly(2026, 8, 17),
                IsPresent = true,
                MarkedByUserId = seeded.UserId,
                MarkedAt = new DateTimeOffset(2026, 8, 17, 10, 0, 0, TimeSpan.Zero),
                UpdatedAt = new DateTimeOffset(2026, 8, 17, 10, 0, 0, TimeSpan.Zero)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var eveningDetailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.EveningOccurrenceId}?lessonDate=2026-08-17");
        var eveningRevision = (await ReadJsonElementAsync(eveningDetailResponse)).GetProperty("revision").GetString();

        using var eveningPreviewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.EveningOccurrenceId}/cancellation/preview?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = eveningRevision },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, eveningPreviewResponse.StatusCode);

        using var morningDetailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var morningRevision = (await ReadJsonElementAsync(morningDetailResponse)).GetProperty("revision").GetString();
        using var morningPreviewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation/preview?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = morningRevision },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, morningPreviewResponse.StatusCode);
        var problem = await ReadJsonElementAsync(morningPreviewResponse);
        Assert.Equal("lesson-attendance-state-conflict", problem.GetProperty("code").GetString());
        Assert.Equal(1, problem.GetProperty("attendanceMarksCount").GetInt32());
        Assert.Equal("edit-attendance-before-cancellation", problem.GetProperty("recoveryCode").GetString());
    }

    [Fact]
    public async Task Change_projected_occurrence_moves_current_locator_and_consumes_preview_once()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        var change = new
        {
            scope = "Occurrence",
            newLessonDate = "2026-08-18",
            startTime = "11:15",
            durationMinutes = 60,
            hallId = seeded.HallId,
            expectedRevision = revision
        };
        using var previewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            change,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var token = preview.GetProperty("confirmationToken").GetString();
        Assert.Equal("2026-08-18", preview.GetProperty("lesson").GetProperty("lessonDate").GetString());
        Assert.Empty(preview.GetProperty("warnings").EnumerateArray());

        using var executeResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change?lessonDate=2026-08-17",
            new
            {
                change.scope,
                change.newLessonDate,
                change.startTime,
                change.durationMinutes,
                change.hallId,
                change.expectedRevision,
                confirmationToken = token
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        var moved = await ReadJsonElementAsync(executeResponse);
        Assert.True(moved.GetProperty("isMaterialized").GetBoolean());
        Assert.Equal("2026-08-18", moved.GetProperty("lessonDate").GetString());
        Assert.Equal("11:15", moved.GetProperty("startTime").GetString());

        using var oldLocator = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.NotFound, oldLocator.StatusCode);
        using var currentLocator = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-18");
        Assert.Equal(HttpStatusCode.OK, currentLocator.StatusCode);

        using var replay = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change?lessonDate=2026-08-17",
            new
            {
                change.scope,
                change.newLessonDate,
                change.startTime,
                change.durationMinutes,
                change.hallId,
                change.expectedRevision,
                confirmationToken = token
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
        var replayProblem = await ReadJsonElementAsync(replay);
        Assert.Equal("lesson-mutation-preview-invalid", replayProblem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var occurrence = Assert.Single(await dbContext.LessonOccurrences.ToArrayAsync());
        Assert.Equal(new DateOnly(2026, 8, 17), occurrence.ProjectedDate);
        Assert.Equal(new DateOnly(2026, 8, 18), occurrence.LessonDate);
        Assert.Equal(seeded.MorningSlotLineageId, occurrence.SourceSlotLineageId);
        Assert.Equal(1, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(tokenRow => tokenRow.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "LessonOccurrenceChanged"));
    }

    [Fact]
    public async Task Change_preview_rejects_same_group_overlap_without_token()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        using var response = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            new
            {
                scope = "Occurrence",
                newLessonDate = "2026-08-17",
                startTime = "18:45",
                durationMinutes = 30,
                hallId = seeded.HallId,
                expectedRevision = revision
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.True(problem.GetProperty("errors").TryGetProperty("startTime", out _));
    }

    [Fact]
    public async Task Change_execute_returns_stale_when_revision_changed_after_preview()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        var change = new
        {
            scope = "Occurrence",
            newLessonDate = "2026-08-18",
            startTime = "11:15",
            durationMinutes = 60,
            hallId = seeded.HallId,
            expectedRevision = revision
        };
        using var previewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            change,
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var token = (await ReadJsonElementAsync(previewResponse)).GetProperty("confirmationToken").GetString();

        using var cancellationPreviewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation/preview?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = revision },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, cancellationPreviewResponse.StatusCode);
        var cancellationToken = (await ReadJsonElementAsync(cancellationPreviewResponse))
            .GetProperty("confirmationToken")
            .GetString();

        using var cancelResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/cancellation?lessonDate=2026-08-17",
            new { action = "Cancel", expectedRevision = revision, confirmationToken = cancellationToken },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);

        using var staleResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change?lessonDate=2026-08-17",
            new
            {
                change.scope,
                change.newLessonDate,
                change.startTime,
                change.durationMinutes,
                change.hallId,
                change.expectedRevision,
                confirmationToken = token
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, staleResponse.StatusCode);
        var problem = await ReadJsonElementAsync(staleResponse);
        Assert.Equal("lesson-mutation-preview-stale", problem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var changeTokenHash = ScheduleMutationTokenPolicy.ComputeSha256Base64Url(token!);
        Assert.False(await dbContext.ScheduleMutationConfirmationTokens.AnyAsync(tokenRow =>
            tokenRow.TokenHash == changeTokenHash &&
            tokenRow.ConsumedAt != null));
        Assert.Equal(LessonOccurrenceStatus.Cancelled, (await dbContext.LessonOccurrences.SingleAsync()).Status);
        Assert.Equal(0, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "LessonOccurrenceChanged"));
    }

    [Fact]
    public async Task Change_preview_returns_hall_and_trainer_overlap_warnings_for_other_group()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var sourceGroup = await dbContext.TrainingGroups.AsNoTracking().SingleAsync(group => group.Id == seeded.GroupId);
            var now = new DateTimeOffset(2026, 8, 1, 9, 0, 0, TimeSpan.Zero);
            var otherGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = sourceGroup.BranchId,
                HallId = seeded.HallId,
                GroupTypeId = sourceGroup.GroupTypeId,
                Name = "Other Group",
                TrainingStartTime = new TimeOnly(11, 30),
                DurationMinutes = 60,
                Weekdays = [2],
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            var otherSeries = new LessonSeries
            {
                Id = Guid.NewGuid(),
                GroupId = otherGroup.Id,
                StartsOn = new DateOnly(2026, 8, 1),
                CreatedAt = now,
                UpdatedAt = now
            };
            var otherRule = new LessonScheduleRuleVersion
            {
                Id = Guid.NewGuid(),
                LessonSeriesId = otherSeries.Id,
                VersionNumber = 1,
                EffectiveFrom = new DateOnly(2026, 8, 1),
                CreatedAt = now
            };
            dbContext.AddRange(
                otherGroup,
                new GroupTrainerAssignment
                {
                    Id = Guid.NewGuid(),
                    GroupId = otherGroup.Id,
                    TrainerId = seeded.TrainerId,
                    ValidFrom = new DateOnly(2026, 8, 1),
                    CreatedByUserId = seeded.UserId,
                    CreatedAt = now
                },
                otherSeries,
                otherRule,
                new LessonScheduleSlot
                {
                    Id = Guid.NewGuid(),
                    LessonScheduleRuleVersionId = otherRule.Id,
                    SlotLineageId = Guid.NewGuid(),
                    IsoWeekday = 2,
                    StartTime = new TimeOnly(11, 30),
                    DurationMinutes = 60,
                    HallId = seeded.HallId,
                    CreatedAt = now
                });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        using var response = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            new
            {
                scope = "Occurrence",
                newLessonDate = "2026-08-18",
                startTime = "11:15",
                durationMinutes = 60,
                hallId = seeded.HallId,
                expectedRevision = revision
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var warnings = (await ReadJsonElementAsync(response))
            .GetProperty("warnings")
            .EnumerateArray()
            .Select(warning => warning.GetProperty("code").GetString()!)
            .ToArray();
        Assert.Equal(["lesson_hall_overlap", "lesson_trainer_overlap"], warnings);
    }

    [Fact]
    public async Task Change_this_and_future_splits_rule_version_without_materializing_occurrences()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        var change = new
        {
            scope = "ThisAndFuture",
            newLessonDate = "2026-08-17",
            startTime = "09:30",
            durationMinutes = 60,
            hallId = seeded.HallId,
            expectedRevision = revision
        };
        using var previewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            change,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        Assert.True(preview.GetProperty("impact").GetProperty("affectsFutureProjection").GetBoolean());
        Assert.Equal("2026-08-17", preview.GetProperty("impact").GetProperty("startsOn").GetString());
        var token = preview.GetProperty("confirmationToken").GetString();

        using var executeResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change?lessonDate=2026-08-17",
            new
            {
                change.scope,
                change.newLessonDate,
                change.startTime,
                change.durationMinutes,
                change.hallId,
                change.expectedRevision,
                confirmationToken = token
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        using var previousWeekResponse = await client.GetAsync("/schedule/lessons?from=2026-08-10&to=2026-08-10");
        var previousWeekItems = (await ReadJsonElementAsync(previousWeekResponse)).GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("10:00", previousWeekItems.Single(item =>
            Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!) ==
            LessonOccurrenceIdPolicy.CreateRecurring(seeded.MorningSlotLineageId, new DateOnly(2026, 8, 10))).GetProperty("startTime").GetString());

        using var selectedWeekResponse = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        var selectedWeekItems = (await ReadJsonElementAsync(selectedWeekResponse)).GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("09:30", selectedWeekItems.Single(item =>
            Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!) == seeded.MorningOccurrenceId).GetProperty("startTime").GetString());
        Assert.Contains(selectedWeekItems, item => item.GetProperty("startTime").GetString() == "18:30");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync());
        var ruleVersions = await dbContext.LessonScheduleRuleVersions
            .Include(version => version.Slots)
            .OrderBy(version => version.VersionNumber)
            .ToArrayAsync();
        Assert.Equal(2, ruleVersions.Length);
        Assert.Equal(new DateOnly(2026, 8, 16), ruleVersions[0].EffectiveTo);
        Assert.Equal(new DateOnly(2026, 8, 17), ruleVersions[1].EffectiveFrom);
        var changedSlot = Assert.Single(ruleVersions[1].Slots, slot => slot.StartTime == new TimeOnly(9, 30));
        Assert.Equal(seeded.MorningSlotLineageId, changedSlot.SlotLineageId);
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log => log.ActionType == "LessonScheduleSeriesChanged"));
    }

    [Fact]
    public async Task Change_entire_series_starts_at_business_today_and_preserves_past_projection()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.Login, seeded.Password);
        using var detailResponse = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        var revision = (await ReadJsonElementAsync(detailResponse)).GetProperty("revision").GetString();

        var change = new
        {
            scope = "EntireSeries",
            newLessonDate = "2026-08-17",
            startTime = "09:15",
            durationMinutes = 60,
            hallId = seeded.HallId,
            expectedRevision = revision
        };
        using var previewResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change/preview?lessonDate=2026-08-17",
            change,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        Assert.Equal("2026-08-23", preview.GetProperty("impact").GetProperty("startsOn").GetString());
        var token = preview.GetProperty("confirmationToken").GetString();

        using var executeResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{seeded.MorningOccurrenceId}/change?lessonDate=2026-08-17",
            new
            {
                change.scope,
                change.newLessonDate,
                change.startTime,
                change.durationMinutes,
                change.hallId,
                change.expectedRevision,
                confirmationToken = token
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        using var pastResponse = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        var pastItems = (await ReadJsonElementAsync(pastResponse)).GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("10:00", pastItems.Single(item =>
            Guid.Parse(item.GetProperty("lessonOccurrenceId").GetString()!) == seeded.MorningOccurrenceId).GetProperty("startTime").GetString());

        using var futureResponse = await client.GetAsync("/schedule/lessons?from=2026-08-24&to=2026-08-24");
        var futureItems = (await ReadJsonElementAsync(futureResponse)).GetProperty("items").EnumerateArray().ToArray();
        Assert.Contains(futureItems, item => item.GetProperty("startTime").GetString() == "09:15");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var ruleVersions = await dbContext.LessonScheduleRuleVersions.OrderBy(version => version.VersionNumber).ToArrayAsync();
        Assert.Equal(new DateOnly(2026, 8, 22), ruleVersions[0].EffectiveTo);
        Assert.Equal(new DateOnly(2026, 8, 23), ruleVersions[1].EffectiveFrom);
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync());
    }

    [Fact]
    public async Task Projected_detail_requires_matching_locator_and_does_not_materialize()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.Login, seeded.Password);

        using var mismatch = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-18");
        Assert.Equal(HttpStatusCode.NotFound, mismatch.StatusCode);

        using var detail = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        var payload = await ReadJsonElementAsync(detail);
        Assert.Equal("10:00", payload.GetProperty("startTime").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.LessonOccurrences.CountAsync());
    }

    [Fact]
    public async Task Moved_materialized_occurrence_suppresses_source_projection_and_resolves_only_current_locator()
    {
        await using var factory = new ScheduleLessonsAppFactory();
        var seeded = await SeedAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.LessonOccurrences.Add(new LessonOccurrence
            {
                Id = seeded.MorningOccurrenceId,
                GroupId = seeded.GroupId,
                LessonDate = new DateOnly(2026, 8, 18),
                StartTime = new TimeOnly(11, 15),
                DurationMinutes = 60,
                HallId = seeded.HallId,
                SourceLessonSeriesId = seeded.SeriesId,
                SourceRuleVersionId = seeded.RuleVersionId,
                SourceSlotId = seeded.MorningSlotId,
                SourceSlotLineageId = seeded.MorningSlotLineageId,
                ProjectedDate = new DateOnly(2026, 8, 17),
                Status = LessonOccurrenceStatus.Scheduled,
                SourceKind = LessonOccurrenceSourceKind.Recurring,
                CreatedAt = new DateTimeOffset(2026, 8, 16, 9, 0, 0, TimeSpan.Zero),
                UpdatedAt = new DateTimeOffset(2026, 8, 16, 9, 0, 0, TimeSpan.Zero)
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.Login, seeded.Password);

        using var sourceDateResponse = await client.GetAsync("/schedule/lessons?from=2026-08-17&to=2026-08-17");
        Assert.Equal(HttpStatusCode.OK, sourceDateResponse.StatusCode);
        var sourceDateItems = (await ReadJsonElementAsync(sourceDateResponse))
            .GetProperty("items")
            .EnumerateArray()
            .ToArray();
        Assert.Single(sourceDateItems);
        Assert.Equal(seeded.EveningOccurrenceId, Guid.Parse(sourceDateItems[0].GetProperty("lessonOccurrenceId").GetString()!));

        using var currentDateResponse = await client.GetAsync("/schedule/lessons?from=2026-08-18&to=2026-08-18");
        Assert.Equal(HttpStatusCode.OK, currentDateResponse.StatusCode);
        var currentDateItems = (await ReadJsonElementAsync(currentDateResponse))
            .GetProperty("items")
            .EnumerateArray()
            .ToArray();
        var moved = Assert.Single(currentDateItems);
        Assert.Equal(seeded.MorningOccurrenceId, Guid.Parse(moved.GetProperty("lessonOccurrenceId").GetString()!));
        Assert.True(moved.GetProperty("isMaterialized").GetBoolean());
        Assert.Equal("2026-08-18", moved.GetProperty("lessonDate").GetString());
        Assert.Equal("11:15", moved.GetProperty("startTime").GetString());

        using var oldLocator = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-17");
        Assert.Equal(HttpStatusCode.NotFound, oldLocator.StatusCode);

        using var currentLocator = await client.GetAsync(
            $"/schedule/lessons/{seeded.MorningOccurrenceId}?lessonDate=2026-08-18");
        Assert.Equal(HttpStatusCode.OK, currentLocator.StatusCode);
    }

    private static async Task<SeededSchedule> SeedAsync(ScheduleLessonsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = new DateTimeOffset(2026, 8, 1, 9, 0, 0, TimeSpan.Zero);
        var password = "schedule-lessons-password";
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Schedule HeadCoach",
            Login = "schedule-headcoach",
            Role = UserRole.HeadCoach,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        user.PasswordHash = passwordHashService.HashPassword(user, password);

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Schedule Branch",
            CreatedAt = now,
            UpdatedAt = now
        };
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Main Hall",
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Kids",
            CreatedAt = now,
            UpdatedAt = now
        };
        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "Two Slots",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var trainer = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Permanent Coach",
            Login = "schedule-coach",
            Role = UserRole.Coach,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            BranchId = branch.Id
        };
        trainer.PasswordHash = passwordHashService.HashPassword(trainer, password);
        var substitute = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Substitute Coach",
            Login = "schedule-substitute",
            Role = UserRole.Coach,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            BranchId = branch.Id
        };
        substitute.PasswordHash = passwordHashService.HashPassword(substitute, password);
        var series = new LessonSeries
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            StartsOn = new DateOnly(2026, 8, 1),
            CreatedAt = now,
            UpdatedAt = now
        };
        var rule = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = series.Id,
            VersionNumber = 1,
            EffectiveFrom = new DateOnly(2026, 8, 1),
            CreatedAt = now
        };
        var morningLineageId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var eveningLineageId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var morningSlotId = Guid.NewGuid();
        dbContext.AddRange(
            branch,
            hall,
            groupType,
            user,
            trainer,
            substitute,
            group,
            new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                TrainerId = trainer.Id,
                ValidFrom = new DateOnly(2026, 8, 1),
                CreatedByUserId = user.Id,
                CreatedAt = now
            },
            series,
            rule,
            new LessonScheduleSlot
            {
                Id = morningSlotId,
                LessonScheduleRuleVersionId = rule.Id,
                SlotLineageId = morningLineageId,
                IsoWeekday = 1,
                StartTime = new TimeOnly(10, 0),
                DurationMinutes = 60,
                HallId = hall.Id,
                CreatedAt = now
            },
            new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                LessonScheduleRuleVersionId = rule.Id,
                SlotLineageId = eveningLineageId,
                IsoWeekday = 1,
                StartTime = new TimeOnly(18, 30),
                DurationMinutes = 75,
                HallId = hall.Id,
                CreatedAt = now
            });
        await dbContext.SaveChangesAsync();

        return new SeededSchedule(
            user.Login,
            password,
            user.Id,
            trainer.Id,
            substitute.Login,
            substitute.Id,
            group.Id,
            hall.Id,
            series.Id,
            rule.Id,
            morningSlotId,
            morningLineageId,
            LessonOccurrenceIdPolicy.CreateRecurring(morningLineageId, new DateOnly(2026, 8, 17)),
            LessonOccurrenceIdPolicy.CreateRecurring(eveningLineageId, new DateOnly(2026, 8, 17)));
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        using var sessionResponse = await client.GetAsync("/auth/session");
        var session = await ReadJsonAsync<SessionPayload>(sessionResponse);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new LoginRequest(login, password))
        };
        request.Headers.Add("X-CSRF-TOKEN", session.CsrfToken);
        using var loginResponse = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return await ReadJsonAsync<SessionPayload>(loginResponse);
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

    private static async Task<HttpResponseMessage> PostJsonAsync<T>(
        HttpClient client,
        string requestUri,
        T payload,
        string csrfToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private sealed record SeededSchedule(
        string Login,
        string Password,
        Guid UserId,
        Guid TrainerId,
        string SubstituteLogin,
        Guid SubstituteTrainerId,
        Guid GroupId,
        Guid HallId,
        Guid SeriesId,
        Guid RuleVersionId,
        Guid MorningSlotId,
        Guid MorningSlotLineageId,
        Guid MorningOccurrenceId,
        Guid EveningOccurrenceId);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role);

    private sealed record LoginRequest(string Login, string Password);

    private sealed class ScheduleLessonsAppFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-schedule-lessons",
                    ["BootstrapUser:FullName"] = "Bootstrap Schedule Lessons"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                services.RemoveAll<IBusinessDateProvider>();
                services.AddSingleton<IBusinessDateProvider>(
                    new FixedBusinessDateProvider(new DateOnly(2026, 8, 23)));

                var databaseName = $"gym-crm-schedule-lessons-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today => today;
    }
}
