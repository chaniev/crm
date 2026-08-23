using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Scheduling;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Audit;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class AttendanceApiTests
{
    // Принятые контрактные допущения (этап 7):
    // 1) Список доступных групп для отметки: GET /attendance/groups
    // 2) Список клиентов занятия: GET /attendance/lessons/{lessonOccurrenceId}/clients?lessonDate=yyyy-MM-dd
    // 3) Сохранение/редактирование отметок: POST /attendance/lessons/{lessonOccurrenceId}?lessonDate=yyyy-MM-dd
    // 4) Тело отправки: { attendanceMarks: [{ clientId, state }] }

    [Fact]
    public async Task HeadCoach_can_mark_attendance_edit_it_and_trigger_single_visit_write_off()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        Assert.Equal("HeadCoach", session.User?.Role);

        using (var groupsResponse = await client.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsResponse.StatusCode);
            var groupsPayload = await ReadJsonElementAsync(groupsResponse);
            var groups = GetArrayPayload(groupsPayload, "data", "items", "groups");
            var assignedGroup = FindById(groups, seeded.AssignedGroupId);
            Assert.False(assignedGroup.ValueKind == JsonValueKind.Undefined);
            Assert.Equal(60, assignedGroup.GetProperty("durationMinutes").GetInt32());
            Assert.Equal(
                [1, 3],
                assignedGroup.GetProperty("weekdays").EnumerateArray().Select(weekday => weekday.GetInt32()).ToArray());
        }

        var trainingDate = GetBusinessToday().ToDateTime(TimeOnly.MinValue);
        var trainingDateString = trainingDate.ToString("yyyy-MM-dd");
        var lessonOccurrenceId = await ResolveLessonOccurrenceIdAsync(
            factory,
            seeded.AssignedGroupId,
            DateOnly.FromDateTime(trainingDate));

        using (var legacyClientsResponse = await client.GetAsync(
                   $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={trainingDateString}"))
        {
            AssertLegacyRouteIsAbsent(legacyClientsResponse);
        }

        using var clientsResponse = await client.GetAsync(
            LessonClientsPath(lessonOccurrenceId, trainingDateString));
        var clientsResponseBody = await clientsResponse.Content.ReadAsStringAsync();
        Assert.True(
            clientsResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {clientsResponse.StatusCode}. Body: {clientsResponseBody}");

        var clientsPayload = await ReadJsonElementAsync(clientsResponse);
        var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
        var targetClient = FindById(clients, seeded.SingleVisitClientId);
        Assert.False(targetClient.ValueKind == JsonValueKind.Undefined);

        using var firstSaveResponse = await PostJsonAsync(
            client,
            LessonSavePath(lessonOccurrenceId, trainingDateString),
            new
            {
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        State = "Absent"
                    }
                }
            },
            session.CsrfToken);
        Assert.True(firstSaveResponse.IsSuccessStatusCode);

        using var secondSaveResponse = await PostJsonAsync(
            client,
            LessonSavePath(lessonOccurrenceId, trainingDateString),
            new
            {
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        State = "Present"
                    }
                }
            },
            session.CsrfToken);
        Assert.True(secondSaveResponse.IsSuccessStatusCode);

        var operationStartedAt = DateTimeOffset.UtcNow.AddMinutes(-5);
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var attendanceDate = DateOnly.FromDateTime(trainingDate);
        var attendance = await dbContext.Attendance.SingleAsync(
            mark => mark.ClientId == seeded.SingleVisitClientId &&
                mark.GroupId == seeded.AssignedGroupId &&
                mark.TrainingDate == attendanceDate,
            cancellationToken: default);

        Assert.True(attendance.IsPresent);
        Assert.Equal(seeded.HeadCoachId, attendance.MarkedByUserId);

        var currentMembership = await dbContext.ClientMemberships.SingleAsync(
            membership => membership.ClientId == seeded.SingleVisitClientId &&
                membership.ValidTo == null,
            cancellationToken: default);

        Assert.True(currentMembership.SingleVisitUsed);

        var attendanceAuditEntries = await dbContext.AuditLogs
            .Where(log =>
                log.UserId == seeded.HeadCoachId &&
                log.EntityType == "Attendance" &&
                log.CreatedAt >= operationStartedAt)
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        Assert.NotEmpty(attendanceAuditEntries);
        Assert.Contains(attendanceAuditEntries, log =>
            !string.IsNullOrWhiteSpace(log.OldValueJson) &&
            !string.IsNullOrWhiteSpace(log.NewValueJson));

        var markedLog = attendanceAuditEntries.Single(log => log.ActionType == "AttendanceMarked");
        Assert.Equal(
            $"Пользователь '{seeded.HeadCoachLogin}' изменил посещаемость клиента 'Разовый Клиент' в группе 'Attendance Group' за {trainingDateString}.",
            markedLog.Description);

        var updatedLog = attendanceAuditEntries.Single(log => log.ActionType == "AttendanceUpdated");
        Assert.Equal(
            $"Пользователь '{seeded.HeadCoachLogin}' изменил посещаемость клиента 'Разовый Клиент' в группе 'Attendance Group' за {trainingDateString}.",
            updatedLog.Description);

        var writeOffLog = await dbContext.AuditLogs.SingleAsync(log =>
            log.UserId == seeded.HeadCoachId &&
            log.ActionType == "ClientMembershipSingleVisitWrittenOff" &&
            log.EntityType == "ClientMembership" &&
            log.CreatedAt >= operationStartedAt);
        Assert.Equal(
            $"Пользователь '{seeded.HeadCoachLogin}' списал разовое посещение клиента 'Разовый Клиент'.",
            writeOffLog.Description);
    }

    [Fact]
    public async Task Administrator_is_forbidden_and_unassigned_coach_is_forbidden_for_group_attendance_api()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var adminSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        Assert.Equal("Administrator", adminSession.User?.Role);

        using (var groupsResponse = await client.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupsResponse);
            Assert.Empty(GetArrayPayload(payload, "groups").EnumerateArray());
        }

        using var forbiddenSaveForAdmin = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = GetBusinessToday().ToString("yyyy-MM-dd"),
                AttendanceMarks = Array.Empty<object>()
            },
            adminSession.CsrfToken);
        AssertLegacyRouteIsAbsent(forbiddenSaveForAdmin);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using var forbiddenCoachGroupClients = await GetLessonClientsAsync(
            factory,
            coachClient,
            seeded.UnassignedGroupId,
            GetBusinessToday().ToString("yyyy-MM-dd"));
        await AssertLessonOccurrenceNotFoundProblemAsync(forbiddenCoachGroupClients);

        using var forbiddenCoachSave = await PostJsonAsync(
            coachClient,
            LessonSavePath(
                await ResolveLessonOccurrenceIdAsync(factory, seeded.UnassignedGroupId, GetBusinessToday()),
                GetBusinessToday().ToString("yyyy-MM-dd")),
            new
            {
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.SingleVisitClientId,
                        State = "Present"
                    }
                }
            },
            coachSession.CsrfToken);
        await AssertLessonOccurrenceNotFoundProblemAsync(forbiddenCoachSave);
    }

    [Fact]
    public async Task Task080_administrator_reaches_empty_attendance_scope_without_group_grants()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        using (var sessionResponse = await client.GetAsync("/auth/session"))
        {
            Assert.Equal(HttpStatusCode.OK, sessionResponse.StatusCode);
            var sessionPayload = await ReadJsonElementAsync(sessionResponse);
            var user = sessionPayload.GetProperty("user");
            Assert.True(user.GetProperty("permissions").GetProperty("canMarkAttendance").GetBoolean());
            var scope = user.GetProperty("attendanceScope");
            Assert.Equal("AdministratorGrants", scope.GetProperty("kind").GetString());
            Assert.Empty(scope.GetProperty("groupIds").EnumerateArray());
            Assert.Empty(user.GetProperty("assignedGroupIds").EnumerateArray());
        }

        using (var groupsResponse = await client.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupsResponse);
            Assert.Empty(GetArrayPayload(payload, "groups").EnumerateArray());
            Assert.True(payload.TryGetProperty("minTrainingDate", out var minTrainingDate));
            Assert.Equal(JsonValueKind.Null, minTrainingDate.ValueKind);
            Assert.True(payload.TryGetProperty("maxTrainingDate", out _));
        }

        using var directResponse = await GetLessonClientsAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            GetBusinessToday().ToString("yyyy-MM-dd"));
        await AssertLessonOccurrenceNotFoundProblemAsync(directResponse);
    }

    [Fact]
    public async Task SuperAdministrator_can_list_read_and_save_attendance_in_two_branches()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        Assert.Equal("SuperAdministrator", session.User?.Role);

        using (var groupsResponse = await client.GetAsync("/attendance/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupsResponse);
            var groups = GetArrayPayload(payload, "data", "items", "groups");
            Assert.False(FindById(groups, seeded.AssignedGroupId).ValueKind == JsonValueKind.Undefined);
            Assert.False(FindById(groups, seeded.ForeignBranchGroupId).ValueKind == JsonValueKind.Undefined);
        }

        var trainingDate = GetBusinessToday().ToString("yyyy-MM-dd");
        foreach (var (groupId, clientId) in new[]
                 {
                     (seeded.AssignedGroupId, seeded.WarningClientId),
                     (seeded.ForeignBranchGroupId, seeded.ForeignBranchClientId)
                 })
        {
            using (var rosterResponse = await GetLessonClientsAsync(factory, client, groupId, trainingDate))
            {
                Assert.Equal(HttpStatusCode.OK, rosterResponse.StatusCode);
                var payload = await ReadJsonElementAsync(rosterResponse);
                var clients = GetArrayPayload(payload, "data", "items", "clients");
                Assert.False(FindById(clients, clientId).ValueKind == JsonValueKind.Undefined);
            }

            using var saveResponse = await PostLessonAttendanceAsync(
                factory,
                client,
                groupId,
                trainingDate,
                new
                {
                    AttendanceMarks = new[]
                    {
                        new
                        {
                            ClientId = clientId,
                            State = "Absent"
                        }
                    }
                },
                session.CsrfToken);
            Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var markedGroups = await dbContext.Attendance
            .Where(attendance =>
                attendance.MarkedByUserId == seeded.SuperAdministratorId &&
                attendance.TrainingDate == GetBusinessToday())
            .Select(attendance => attendance.GroupId)
            .ToListAsync();

        Assert.Contains(seeded.AssignedGroupId, markedGroups);
        Assert.Contains(seeded.ForeignBranchGroupId, markedGroups);
    }

    [Fact]
    public async Task Status_free_membership_does_not_warn_and_marking_is_stored_for_training_date()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var coachSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        var pastTrainingDate = GetBusinessToday().AddDays(-2);
        var pastTrainingDateString = pastTrainingDate.ToString("yyyy-MM-dd");

        using var clientsResponse = await GetLessonClientsAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            pastTrainingDateString);
        var clientsResponseBody = await clientsResponse.Content.ReadAsStringAsync();
        Assert.True(
            clientsResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {clientsResponse.StatusCode}. Body: {clientsResponseBody}");

        var clientsPayload = await ReadJsonElementAsync(clientsResponse);
        var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
        var warningClient = FindById(clients, seeded.WarningClientId);
        Assert.False(warningClient.ValueKind == JsonValueKind.Undefined);
        Assert.False(HasMembershipWarning(warningClient), "Payment status must not create attendance warnings.");
        Assert.Equal(
            JsonValueKind.Undefined,
            GetPropertyOrNull(warningClient, "hasUnpaidCurrentMembership", "HasUnpaidCurrentMembership").ValueKind);
        Assert.Equal(
            JsonValueKind.Undefined,
            GetPropertyOrNull(warningClient, "hasActivePaidMembership", "HasActivePaidMembership").ValueKind);
        Assert.True(GetBoolFromAnyCase(warningClient, "hasActiveMembership", "HasActiveMembership"));

        using var markResponse = await PostLessonAttendanceAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            pastTrainingDateString,
            new
            {
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.WarningClientId,
                        State = "Present"
                    }
                }
            },
            coachSession.CsrfToken);

        var markResponseBody = await markResponse.Content.ReadAsStringAsync();
        if (!markResponse.IsSuccessStatusCode)
        {
            throw new Xunit.Sdk.XunitException(
                $"Expected success, got {markResponse.StatusCode}. Body: {markResponseBody}");
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedAttendance = await dbContext.Attendance.SingleOrDefaultAsync(
            mark => mark.ClientId == seeded.WarningClientId &&
                mark.GroupId == seeded.AssignedGroupId &&
                mark.TrainingDate == pastTrainingDate);

        Assert.NotNull(persistedAttendance);
        Assert.True(persistedAttendance.IsPresent);
    }

    [Fact]
    public async Task Professional_client_attendance_has_no_warning_and_does_not_write_off_single_visit()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var trainingDate = GetBusinessToday();
        var trainingDateString = trainingDate.ToString("yyyy-MM-dd");

        using (var clientsResponse = await GetLessonClientsAsync(
                   factory,
                   client,
                   seeded.AssignedGroupId,
                   trainingDateString))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
            var professionalClient = FindById(clients, seeded.ProfessionalClientId);
            Assert.False(professionalClient.ValueKind == JsonValueKind.Undefined);
            Assert.True(GetBoolFromAnyCase(professionalClient, "isProfessional", "IsProfessional"));
            Assert.False(HasMembershipWarning(professionalClient), "Professional client must not have membership warning.");
            Assert.True(GetBoolFromAnyCase(professionalClient, "hasActiveMembership", "HasActiveMembership"));
        }

        var operationStartedAt = DateTimeOffset.UtcNow;
        using var markResponse = await PostLessonAttendanceAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            trainingDateString,
            new
            {
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = seeded.ProfessionalClientId,
                        State = "Present"
                    }
                }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, markResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var attendance = await dbContext.Attendance.SingleAsync(
            mark => mark.ClientId == seeded.ProfessionalClientId &&
                mark.GroupId == seeded.AssignedGroupId &&
                mark.TrainingDate == trainingDate);
        Assert.True(attendance.IsPresent);

        var membership = await dbContext.ClientMemberships.SingleAsync(
            candidate => candidate.ClientId == seeded.ProfessionalClientId && candidate.ValidTo == null);
        Assert.False(membership.SingleVisitUsed);

        var writeOffAuditExists = await dbContext.AuditLogs.AnyAsync(log =>
            log.ActionType == "ClientMembershipSingleVisitWrittenOff" &&
            log.EntityType == "ClientMembership" &&
            log.CreatedAt >= operationStartedAt);
        Assert.False(writeOffAuditExists);
    }

    [Fact]
    public async Task Tri_state_restore_and_reset_preserve_exact_single_visit_lineage_and_audit()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var date = GetBusinessToday();
        var dateText = date.ToString("yyyy-MM-dd");

        using (var rosterResponse = await GetLessonClientsAsync(
                   factory,
                   client,
                   seeded.AssignedGroupId,
                   dateText))
        {
            var roster = await ReadJsonElementAsync(rosterResponse);
            Assert.Equal(dateText, roster.GetProperty("today").GetString());
            Assert.Equal("Unmarked", FindById(roster.GetProperty("clients"), seeded.SingleVisitClientId).GetProperty("state").GetString());
        }

        await SaveStateAsync(factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Present", session.CsrfToken);

        Guid writtenOffMembershipId;
        Guid saleId;
        DateTimeOffset markedAt;
        int membershipVersionCount;
        int auditCount;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var attendance = await db.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            Assert.NotNull(attendance.SingleVisitMembershipSaleId);
            Assert.NotNull(attendance.SingleVisitWriteOffMembershipId);
            writtenOffMembershipId = attendance.SingleVisitWriteOffMembershipId!.Value;
            saleId = attendance.SingleVisitMembershipSaleId!.Value;
            markedAt = attendance.MarkedAt;
            membershipVersionCount = await db.ClientMemberships.CountAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            auditCount = await db.AuditLogs.CountAsync();
        }

        await SaveStateAsync(factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Present", session.CsrfToken);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var unchanged = await db.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            Assert.Equal(markedAt, unchanged.MarkedAt);
            Assert.Equal(membershipVersionCount, await db.ClientMemberships.CountAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId));
            Assert.Equal(auditCount, await db.AuditLogs.CountAsync());
        }

        await SaveStateAsync(factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Absent", session.CsrfToken);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var attendance = await db.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            Assert.False(attendance.IsPresent);
            Assert.Null(attendance.SingleVisitMembershipSaleId);
            Assert.Null(attendance.SingleVisitWriteOffMembershipId);

            var writtenOff = await db.ClientMemberships.SingleAsync(candidate => candidate.Id == writtenOffMembershipId);
            Assert.Equal(saleId, writtenOff.SaleId);
            Assert.NotNull(writtenOff.ValidTo);
            var restored = await db.ClientMemberships.SingleAsync(candidate =>
                candidate.ClientId == seeded.SingleVisitClientId && candidate.ValidTo == null);
            Assert.Equal(saleId, restored.SaleId);
            Assert.False(restored.SingleVisitUsed);
            Assert.Equal(ClientMembershipChangeReason.SingleVisitRestore, restored.ChangeReason);
            Assert.Contains(await db.AuditLogs.ToListAsync(), log => log.ActionType == "ClientMembershipSingleVisitRestored");
        }

        await SaveStateAsync(factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Unmarked", session.CsrfToken);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.False(await db.Attendance.AnyAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId));
            var resetAudit = (await db.AuditLogs.Where(log => log.ActionType == "AttendanceUpdated").ToListAsync()).Last();
            Assert.Contains("\"state\":\"Unmarked\"", resetAudit.NewValueJson);
        }
    }

    [Fact]
    public async Task Invalid_or_future_state_is_rejected_without_side_effects()
    {
        await using var factory = new AttendanceAppFactory();
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var today = GetBusinessToday();

        foreach (var invalidState in new[] { "present", "0", "1", "2", "3" })
        {
            using var invalid = await PostStateAsync(
                factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, today.ToString("yyyy-MM-dd"), invalidState, session.CsrfToken);
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            var invalidProblem = await ReadJsonElementAsync(invalid);
            Assert.True(invalidProblem.GetProperty("errors").TryGetProperty("attendanceMarks", out _));
        }

        using var future = await PostStateAsync(
            factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, today.AddDays(1).ToString("yyyy-MM-dd"), "Present", session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, future.StatusCode);
        var futureProblem = await ReadJsonElementAsync(future);
        Assert.True(futureProblem.GetProperty("errors").TryGetProperty("trainingDate", out _));

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await db.Attendance.AnyAsync());
        Assert.False(await db.AuditLogs.AnyAsync(log => log.EntityType == "Attendance"));
    }

    [Fact]
    public async Task Mandatory_audit_failure_rolls_back_attendance_and_membership_on_relational_provider()
    {
        await using var factory = new AttendanceAppFactory(useSqlite: true, throwAudit: true);
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostStateAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            seeded.SingleVisitClientId,
            GetBusinessToday().ToString("yyyy-MM-dd"),
            "Present",
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await db.Attendance.AnyAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId));
        var memberships = await db.ClientMemberships
            .Where(candidate => candidate.ClientId == seeded.SingleVisitClientId)
            .ToListAsync();
        var membership = Assert.Single(memberships);
        Assert.False(membership.SingleVisitUsed);
        Assert.Null(membership.ValidTo);
        Assert.False(await db.AuditLogs.AnyAsync(log =>
            log.EntityType == AttendanceAuditContract.AttendanceEntityType ||
            log.EntityType == AttendanceAuditContract.MembershipEntityType));
    }

    [Fact]
    public async Task Restore_conflict_rolls_back_entire_relational_batch()
    {
        await using var factory = new AttendanceAppFactory(useSqlite: true);
        var seeded = await SeedAttendanceDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var date = GetBusinessToday().ToString("yyyy-MM-dd");
        await SaveStateAsync(factory, client, seeded.AssignedGroupId, seeded.SingleVisitClientId, date, "Present", session.CsrfToken);

        Guid provenanceSaleId;
        Guid provenanceMembershipId;
        Guid conflictingMembershipId;
        int auditCount;
        await using (var mutationScope = factory.Services.CreateAsyncScope())
        {
            var db = mutationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var attendance = await db.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            provenanceSaleId = attendance.SingleVisitMembershipSaleId!.Value;
            provenanceMembershipId = attendance.SingleVisitWriteOffMembershipId!.Value;
            var writtenOff = await db.ClientMemberships
                .Include(candidate => candidate.TargetGroups)
                .SingleAsync(candidate => candidate.Id == provenanceMembershipId);
            var now = DateTimeOffset.UtcNow;
            writtenOff.ValidTo = now;
            conflictingMembershipId = Guid.NewGuid();
            var conflictingMembership = new ClientMembership
            {
                Id = conflictingMembershipId,
                ClientId = writtenOff.ClientId,
                SaleId = writtenOff.SaleId,
                BehaviorKind = writtenOff.BehaviorKind,
                IndividualValidFrom = writtenOff.IndividualValidFrom,
                IndividualValidTo = writtenOff.IndividualValidTo,
                SingleVisitUsed = writtenOff.SingleVisitUsed,
                ChangeReason = ClientMembershipChangeReason.Correction,
                ChangedByUserId = seeded.HeadCoachId,
                ValidFrom = now,
                CreatedAt = now
            };
            foreach (var target in writtenOff.TargetGroups.OrderBy(target => target.Position))
            {
                conflictingMembership.TargetGroups.Add(new ClientMembershipTargetGroup
                {
                    ClientMembershipId = conflictingMembershipId,
                    GroupId = target.GroupId,
                    BranchId = target.BranchId,
                    Position = target.Position
                });
            }

            db.ClientMemberships.Add(conflictingMembership);
            await db.SaveChangesAsync();
            auditCount = await db.AuditLogs.CountAsync();
        }

        using var conflict = await PostLessonAttendanceAsync(
            factory,
            client,
            seeded.AssignedGroupId,
            date,
            new
            {
                AttendanceMarks = new object[]
                {
                    new { ClientId = seeded.ProfessionalClientId, State = "Present" },
                    new { ClientId = seeded.SingleVisitClientId, State = "Absent" }
                }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, conflict.StatusCode);

        await using var verificationScope = factory.Services.CreateAsyncScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await verificationDb.Attendance.AnyAsync(candidate => candidate.ClientId == seeded.ProfessionalClientId));
        var unchangedAttendance = await verificationDb.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
        Assert.True(unchangedAttendance.IsPresent);
        Assert.Equal(provenanceSaleId, unchangedAttendance.SingleVisitMembershipSaleId);
        Assert.Equal(provenanceMembershipId, unchangedAttendance.SingleVisitWriteOffMembershipId);
        var currentMembership = await verificationDb.ClientMemberships.SingleAsync(candidate =>
            candidate.ClientId == seeded.SingleVisitClientId && candidate.ValidTo == null);
        Assert.Equal(conflictingMembershipId, currentMembership.Id);
        Assert.Equal(auditCount, await verificationDb.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task Attendance_service_rejects_ambient_relational_transaction()
    {
        await using var factory = new AttendanceAppFactory(useSqlite: true);
        var seeded = await SeedAttendanceDataAsync(factory);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IAttendanceService>();
        await using var transaction = await db.Database.BeginTransactionAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => service.SaveAsync(
            new SaveAttendanceCommand(
                Guid.NewGuid(),
                seeded.AssignedGroupId,
                GetBusinessToday(),
                seeded.HeadCoachId,
                seeded.HeadCoachLogin,
                new AttendanceAuditContext(),
                [new AttendanceMarkCommand(seeded.SingleVisitClientId, AttendanceState.Present)]),
            CancellationToken.None));

        Assert.Contains("ambient database transaction", exception.Message);
        Assert.False(await db.Attendance.AnyAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId));
    }

    private static async Task SaveStateAsync(
        AttendanceAppFactory factory,
        HttpClient client,
        Guid groupId,
        Guid clientId,
        string date,
        string state,
        string csrfToken)
    {
        using var response = await PostStateAsync(factory, client, groupId, clientId, date, state, csrfToken);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Expected success, got {response.StatusCode}. Body: {body}");
    }

    private static async Task<HttpResponseMessage> PostStateAsync(
        AttendanceAppFactory factory,
        HttpClient client,
        Guid groupId,
        Guid clientId,
        string date,
        string state,
        string csrfToken)
    {
        var lessonOccurrenceId = await ResolveLessonOccurrenceIdAsync(factory, groupId, ParseTrainingDateText(date));
        return await PostJsonAsync(client, LessonSavePath(lessonOccurrenceId, date), new
        {
            AttendanceMarks = new[] { new { ClientId = clientId, State = state } }
        }, csrfToken);
    }

    private static async Task<HttpResponseMessage> GetLessonClientsAsync(
        AttendanceAppFactory factory,
        HttpClient client,
        Guid groupId,
        string date)
    {
        var lessonOccurrenceId = await ResolveLessonOccurrenceIdAsync(factory, groupId, ParseTrainingDateText(date));
        return await client.GetAsync(LessonClientsPath(lessonOccurrenceId, date));
    }

    private static async Task<HttpResponseMessage> PostLessonAttendanceAsync<TPayload>(
        AttendanceAppFactory factory,
        HttpClient client,
        Guid groupId,
        string date,
        TPayload payload,
        string csrfToken)
    {
        var lessonOccurrenceId = await ResolveLessonOccurrenceIdAsync(factory, groupId, ParseTrainingDateText(date));
        return await PostJsonAsync(client, LessonSavePath(lessonOccurrenceId, date), payload, csrfToken);
    }

    private static async Task<Guid> ResolveLessonOccurrenceIdAsync(
        AttendanceAppFactory factory,
        Guid groupId,
        DateOnly lessonDate)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var materializedIds = await dbContext.LessonOccurrences
            .Where(occurrence => occurrence.GroupId == groupId && occurrence.LessonDate == lessonDate)
            .Select(occurrence => occurrence.Id)
            .ToArrayAsync();
        if (materializedIds.Length == 1)
        {
            return materializedIds[0];
        }

        var isoWeekday = lessonDate.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)lessonDate.DayOfWeek;
        var slotLineageId = await dbContext.LessonSeries
            .Where(series =>
                series.GroupId == groupId &&
                series.StartsOn <= lessonDate &&
                (series.EndsOn == null || series.EndsOn >= lessonDate))
            .SelectMany(series => series.RuleVersions
                .Where(version =>
                    version.EffectiveFrom <= lessonDate &&
                    (version.EffectiveTo == null || version.EffectiveTo >= lessonDate)))
            .SelectMany(version => version.Slots)
            .Where(slot => slot.IsoWeekday == isoWeekday)
            .Select(slot => slot.SlotLineageId)
            .SingleAsync();

        return LessonOccurrenceIdPolicy.CreateRecurring(slotLineageId, lessonDate);
    }

    private static string LessonClientsPath(Guid lessonOccurrenceId, string lessonDate) =>
        $"/attendance/lessons/{lessonOccurrenceId}/clients?lessonDate={lessonDate}";

    private static string LessonSavePath(Guid lessonOccurrenceId, string lessonDate) =>
        $"/attendance/lessons/{lessonOccurrenceId}?lessonDate={lessonDate}";

    private static DateOnly ParseTrainingDateText(string date) =>
        DateOnly.ParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static async Task<SeededAttendanceData> SeedAttendanceDataAsync(AttendanceAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        await dbContext.Database.EnsureCreatedAsync();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage7-password";

        var headCoach = CreateUser("headcoach-stage7", "Главный тренер Stage 7", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var superAdministrator = CreateUser(
            "superadministrator-stage7",
            "Суперадминистратор Stage 7",
            UserRole.SuperAdministrator,
            sharedPassword,
            now,
            passwordHashService);
        var administrator = CreateUser(
            "administrator-stage7",
            "Администратор Stage 7",
            UserRole.Administrator,
            sharedPassword,
            now,
            passwordHashService);
        var coach = CreateUser("coach-stage7", "Тренер Stage 7", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Foreign Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = branch.Id;
        var assignedHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Attendance Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var unassignedHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Unassigned Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            Name = "Foreign Attendance Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Default Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var assignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = assignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Attendance Group",
            TrainingStartTime = new TimeOnly(8, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var unassignedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = unassignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Unassigned Group",
            TrainingStartTime = new TimeOnly(19, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            HallId = foreignHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Foreign Attendance Group",
            TrainingStartTime = new TimeOnly(20, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 2, 4 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var warningClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Проблемный",
            FirstName = "Клиент",
            Phone = "+79990001110",
            CreatedAt = now,
            UpdatedAt = now
        };

        var singleVisitClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Разовый",
            FirstName = "Клиент",
            Phone = "+79990001111",
            CreatedAt = now,
            UpdatedAt = now
        };

        var professionalClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Профессионал",
            FirstName = "Клиент",
            Phone = "+79990001112",
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            LastName = "Иностранный",
            FirstName = "Филиал",
            Phone = "+79990001113",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, superAdministrator, administrator, coach);
        dbContext.Branches.AddRange(branch, foreignBranch);
        dbContext.Halls.AddRange(assignedHall, unassignedHall, foreignHall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(assignedGroup, unassignedGroup, foreignGroup);
        dbContext.Clients.AddRange(warningClient, singleVisitClient, professionalClient, foreignClient);
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = assignedGroup.Id,
            TrainerId = coach.Id
        });
        if (!factory.UseSqlite)
        {
            AddLessonSeriesForAllWeekdays(assignedGroup, assignedHall.Id, now, dbContext);
            AddLessonSeriesForAllWeekdays(unassignedGroup, unassignedHall.Id, now, dbContext);
            AddLessonSeriesForAllWeekdays(foreignGroup, foreignHall.Id, now, dbContext);
        }
        await dbContext.SaveChangesAsync();
        if (factory.UseSqlite)
        {
            await InsertMaterializedLessonOccurrenceAsync(assignedGroup, assignedHall.Id, GetBusinessToday(), now, dbContext);
        }

        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = warningClient.Id,
            GroupId = assignedGroup.Id,
            BranchId = branch.Id
        });
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = singleVisitClient.Id,
            GroupId = assignedGroup.Id,
            BranchId = branch.Id
        });
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = professionalClient.Id,
            GroupId = assignedGroup.Id,
            BranchId = branch.Id
        });
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = foreignClient.Id,
            GroupId = foreignGroup.Id,
            BranchId = foreignBranch.Id
        });

        await AddMembershipAsync(
            dbContext,
            warningClient.Id,
            coach.Id,
            MembershipBehaviorKind.Term,
            assignedGroup.Id,
            branch.Id,
            GetBusinessToday().AddMonths(-2),
            GetBusinessToday().AddDays(-1),
            1200m,
            singleVisitUsed: false);

        await AddMembershipAsync(
            dbContext,
            singleVisitClient.Id,
            coach.Id,
            MembershipBehaviorKind.SingleVisit,
            assignedGroup.Id,
            branch.Id,
            GetBusinessToday(),
            null,
            500m,
            singleVisitUsed: false);

        await AddMembershipAsync(
            dbContext,
            professionalClient.Id,
            coach.Id,
            MembershipBehaviorKind.Professional,
            assignedGroup.Id,
            branch.Id,
            GetBusinessToday(),
            null,
            0m,
            singleVisitUsed: false);
        await AddMembershipAsync(
            dbContext,
            foreignClient.Id,
            superAdministrator.Id,
            MembershipBehaviorKind.Term,
            foreignGroup.Id,
            foreignBranch.Id,
            GetBusinessToday().AddDays(-1),
            GetBusinessToday().AddMonths(1),
            1800m,
            singleVisitUsed: false);

        await dbContext.SaveChangesAsync();

        return new SeededAttendanceData(
            headCoach.Id,
            superAdministrator.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            superAdministrator.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            assignedGroup.Id,
            unassignedGroup.Id,
            foreignGroup.Id,
            warningClient.Id,
            singleVisitClient.Id,
            professionalClient.Id,
            foreignClient.Id);
    }

    private static void AddLessonSeriesForAllWeekdays(
        TrainingGroup group,
        Guid hallId,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        var seriesId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var version = new LessonScheduleRuleVersion
        {
            Id = versionId,
            LessonSeriesId = seriesId,
            VersionNumber = 1,
            EffectiveFrom = GetBusinessToday().AddYears(-1),
            CreatedAt = now
        };
        foreach (var weekday in Enumerable.Range(1, 7))
        {
            version.Slots.Add(new LessonScheduleSlot
            {
                Id = Guid.NewGuid(),
                LessonScheduleRuleVersionId = versionId,
                SlotLineageId = Guid.NewGuid(),
                IsoWeekday = weekday,
                StartTime = group.TrainingStartTime,
                DurationMinutes = group.DurationMinutes,
                HallId = hallId,
                CreatedAt = now
            });
        }

        dbContext.LessonSeries.Add(new LessonSeries
        {
            Id = seriesId,
            GroupId = group.Id,
            StartsOn = GetBusinessToday().AddYears(-1),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now,
            RuleVersions = { version }
        });
    }

    private static async Task InsertMaterializedLessonOccurrenceAsync(
        TrainingGroup group,
        Guid hallId,
        DateOnly lessonDate,
        DateTimeOffset now,
        GymCrmDbContext dbContext)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "LessonOccurrences" (
                "Id", "GroupId", "LessonDate", "StartTime", "DurationMinutes", "HallId",
                "ProjectedDate", "Status", "SourceKind", "Version", "CreatedAt", "UpdatedAt")
            VALUES (
                {LessonOccurrenceIdPolicy.CreateLegacyAttendance(group.Id, lessonDate)}, {group.Id}, {lessonDate}, {group.TrainingStartTime},
                {group.DurationMinutes}, {hallId}, {lessonDate}, {"Scheduled"}, {"LegacyAttendance"}, {1}, {now}, {now})
            """);
    }

    private static async Task AddMembershipAsync(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid changedByUserId,
        MembershipBehaviorKind behaviorKind,
        Guid groupId,
        Guid groupBranchId,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool singleVisitUsed)
    {
        var now = DateTimeOffset.UtcNow;
        var saleId = Guid.NewGuid();
        var branchId = await dbContext.Clients
            .Where(client => client.Id == clientId)
            .Select(client => client.BranchId)
            .SingleAsync();
        var catalogItem = await dbContext.MembershipCatalogItems.FirstOrDefaultAsync(item =>
            item.BehaviorKind == behaviorKind &&
            (behaviorKind == MembershipBehaviorKind.Professional || item.BranchId == branchId));
        if (catalogItem is null)
        {
            catalogItem = behaviorKind == MembershipBehaviorKind.Professional
                ? MembershipCatalogItem.CreateProfessional(
                    "Профессиональный",
                    purchaseDate,
                    null,
                    now)
                : MembershipCatalogItem.CreateBranchOwned(
                    branchId,
                    $"Attendance {behaviorKind}",
                    paymentAmount,
                    behaviorKind,
                    purchaseDate,
                    null,
                    now);
            dbContext.MembershipCatalogItems.Add(catalogItem);
        }
        var membershipId = Guid.NewGuid();
        var membership = new ClientMembership
        {
            Id = membershipId,
            ClientId = clientId,
            SaleId = saleId,
            BehaviorKind = behaviorKind,
            IndividualValidFrom = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : purchaseDate,
            IndividualValidTo = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : expirationDate,
            ProfessionalComment = behaviorKind == MembershipBehaviorKind.Professional
                ? "Льготный статус для посещаемости"
                : null,
            SingleVisitUsed = singleVisitUsed,
            ChangedByUserId = changedByUserId,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ValidFrom = now,
            CreatedAt = now,
            Sale = new ClientMembershipSale
            {
                Id = saleId,
                ClientId = clientId,
                MembershipCatalogItemId = catalogItem.Id,
                MembershipCatalogItem = catalogItem,
                BehaviorKind = behaviorKind,
                PricingMode = ClientMembershipSalePricingMode.Catalog,
                PurchaseDate = purchaseDate,
                PaymentDate = purchaseDate,
                GrossAmount = paymentAmount,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            }
        };
        membership.TargetGroups.Add(new ClientMembershipTargetGroup
        {
            ClientMembershipId = membershipId,
            GroupId = groupId,
            BranchId = groupBranchId,
            Position = 0
        });
        membership.Sale.TargetSnapshots.Add(new ClientMembershipSaleTargetSnapshot
        {
            SaleId = saleId,
            GroupId = groupId,
            BranchId = groupBranchId,
            Position = 0
        });
        dbContext.ClientMemberships.Add(membership);

        await dbContext.SaveChangesAsync();
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        string password,
        DateTimeOffset now,
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
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);
        return user;
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        var initialSession = await GetSessionAsync(client);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return await ReadJsonAsync<SessionPayload>(loginResponse);
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

    private static async Task AssertAttendanceGroupForbiddenProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("/problems/attendance-group-forbidden", payload.GetProperty("type").GetString());
        Assert.Equal("attendance_group_forbidden", payload.GetProperty("code").GetString());
    }

    private static async Task AssertLessonOccurrenceNotFoundProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("/problems/lesson-occurrence-not-found", payload.GetProperty("type").GetString());
        Assert.Equal("lesson-occurrence-not-found", payload.GetProperty("code").GetString());
    }

    private static void AssertLegacyRouteIsAbsent(HttpResponseMessage response)
    {
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static JsonElement GetArrayPayload(JsonElement payload, params string[] alternativeNames)
    {
        if (payload.ValueKind == JsonValueKind.Array)
        {
            return payload;
        }

        foreach (var alternativeName in alternativeNames)
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty(alternativeName, out var data) &&
                data.ValueKind == JsonValueKind.Array)
            {
                return data;
            }
        }

        return payload;
    }

    private static JsonElement GetPropertyOrNull(JsonElement payload, params string[] propertyNames)
    {
        var nameSet = propertyNames.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return default;
        }

        foreach (var property in payload.EnumerateObject())
        {
            if (nameSet.Contains(property.Name))
            {
                return property.Value;
            }
        }

        return default;
    }

    private static bool? GetBoolFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsedValue) => parsedValue,
            _ => null
        };
    }

    private static string? GetStringFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    private static Guid GetGuidFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        if (value.ValueKind != JsonValueKind.String)
        {
            return Guid.Empty;
        }

        return Guid.TryParse(value.GetString(), out var parsedValue)
            ? parsedValue
            : Guid.Empty;
    }

    private static JsonElement FindById(JsonElement array, Guid id)
    {
        if (array.ValueKind != JsonValueKind.Array)
        {
            return default;
        }

        foreach (var item in array.EnumerateArray())
        {
            var itemId = GetGuidFromAnyCase(item, "clientId", "ClientId", "id", "Id");
            if (itemId == id)
            {
                return item;
            }
        }

        return default;
    }

    private static bool HasMembershipWarning(JsonElement clientPayload)
    {
        var explicitWarning = GetBoolFromAnyCase(
            clientPayload,
            "hasWarning",
            "membershipWarning",
            "hasMembershipWarning",
            "membershipWarningVisible",
            "hasMembershipIssue");
        if (explicitWarning is not null)
        {
            return explicitWarning.Value;
        }

        var warningMessage = GetStringFromAnyCase(
            clientPayload,
            "warning",
            "warningMessage",
            "membershipWarningMessage",
            "membershipStatusMessage");
        if (!string.IsNullOrWhiteSpace(warningMessage))
        {
            return true;
        }

        var membershipPayload = GetPropertyOrNull(clientPayload, "currentMembership", "membership", "membershipData");
        if (membershipPayload.ValueKind == JsonValueKind.Object)
        {
            var singleVisitUsed = GetBoolFromAnyCase(
                membershipPayload,
                "singleVisitUsed",
                "singleVisitHasBeenUsed");
            if (singleVisitUsed is true && GetStringFromAnyCase(membershipPayload, "behaviorKind", "type") == "SingleVisit")
            {
                return true;
            }

            var expirationDate = GetStringFromAnyCase(
                membershipPayload,
                "expirationDate",
                "expiresAt",
                "membershipExpirationDate");
            if (DateOnly.TryParse(expirationDate, out var parsedExpirationDate))
            {
                if (parsedExpirationDate < GetBusinessToday())
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static DateOnly GetBusinessToday()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
    }

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role);

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SeededAttendanceData(
        Guid HeadCoachId,
        Guid SuperAdministratorId,
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid AssignedGroupId,
        Guid UnassignedGroupId,
        Guid ForeignBranchGroupId,
        Guid WarningClientId,
        Guid SingleVisitClientId,
        Guid ProfessionalClientId,
        Guid ForeignBranchClientId);

    private sealed class AttendanceAppFactory(bool useSqlite = false, bool throwAudit = false) : WebApplicationFactory<Program>
    {
        public bool UseSqlite { get; } = useSqlite;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage7",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 7"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                if (UseSqlite)
                {
                    var sqliteProvider = new ServiceCollection()
                        .AddEntityFrameworkSqlite()
                        .BuildServiceProvider();
                    var connection = new SqliteConnection("Data Source=:memory:");
                    connection.Open();
                    connection.CreateFunction<string?, string?>("btrim", value => value?.Trim(), isDeterministic: true);
                    connection.CreateFunction<string?, int>("cardinality", value =>
                        string.IsNullOrWhiteSpace(value)
                            ? 0
                            : JsonDocument.Parse(value).RootElement.GetArrayLength(),
                        isDeterministic: true);
                    var bootstrapOptions = new DbContextOptionsBuilder<GymCrmDbContext>()
                        .UseSqlite(connection)
                        .UseInternalServiceProvider(sqliteProvider)
                        .Options;
                    using (var bootstrapContext = new GymCrmDbContext(bootstrapOptions))
                    {
                        bootstrapContext.Database.EnsureCreated();
                    }

                    services.AddSingleton(connection);
                    services.AddDbContext<GymCrmDbContext>((serviceProvider, options) =>
                        options
                            .UseSqlite(serviceProvider.GetRequiredService<SqliteConnection>())
                            .UseInternalServiceProvider(sqliteProvider));
                }
                else
                {
                    var databaseName = $"gym-crm-attendance-tests-{Guid.NewGuid():N}";
                    var entityFrameworkProvider = new ServiceCollection()
                        .AddEntityFrameworkInMemoryDatabase()
                        .BuildServiceProvider();

                    services.AddDbContext<GymCrmDbContext>(options =>
                        options
                            .UseInMemoryDatabase(databaseName)
                            .UseInternalServiceProvider(entityFrameworkProvider));
                }

                if (throwAudit)
                {
                    services.RemoveAll<IAuditLogService>();
                    services.AddScoped<IAuditLogService, ThrowingAuditLogService>();
                }
            });
        }
    }

    private sealed class ThrowingAuditLogService(GymCrmDbContext dbContext) : IAuditLogService
    {
        private readonly AuditLogService inner = new(dbContext);

        public Task WriteAsync(AuditLogEntry entry, CancellationToken cancellationToken = default) =>
            entry.EntityType is "Attendance" or "ClientMembership"
                ? throw new InvalidOperationException("Mandatory attendance audit failed for test.")
                : inner.WriteAsync(entry, cancellationToken);
    }
}
