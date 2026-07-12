using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Application.Audit;
using GymCrm.Application.Attendance;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using GymCrm.Infrastructure.Audit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class AttendanceApiTests
{
    // Принятые контрактные допущения (этап 7):
    // 1) Список доступных групп для отметки: GET /attendance/groups
    // 2) Список клиентов на дату: GET /attendance/groups/{groupId}/clients?trainingDate=yyyy-MM-dd
    // 3) Сохранение/редактирование отметок: POST /attendance/groups/{groupId}
    // 4) Тело отправки: { trainingDate, attendanceMarks: [{ clientId, state }] }

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

        using var clientsResponse = await client.GetAsync(
            $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={trainingDateString}");
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
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = trainingDateString,
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
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = trainingDateString,
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

        using var forbiddenGroupsResponse = await client.GetAsync("/attendance/groups");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenGroupsResponse.StatusCode);

        using var forbiddenSaveForAdmin = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = GetBusinessToday().ToString("yyyy-MM-dd"),
                AttendanceMarks = Array.Empty<object>()
            },
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenSaveForAdmin.StatusCode);

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using var forbiddenCoachGroupClients = await coachClient.GetAsync(
            $"/attendance/groups/{seeded.UnassignedGroupId}/clients?trainingDate={GetBusinessToday():yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenCoachGroupClients.StatusCode);

        using var forbiddenCoachSave = await PostJsonAsync(
            coachClient,
            $"/attendance/groups/{seeded.UnassignedGroupId}",
            new
            {
                TrainingDate = GetBusinessToday().ToString("yyyy-MM-dd"),
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
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenCoachSave.StatusCode);
    }

    [Fact]
    public async Task Attendance_warning_does_not_block_marking_and_is_stored_for_training_date()
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

        using var clientsResponse = await client.GetAsync(
            $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={pastTrainingDateString}");
        var clientsResponseBody = await clientsResponse.Content.ReadAsStringAsync();
        Assert.True(
            clientsResponse.StatusCode == HttpStatusCode.OK,
            $"Expected OK, got {clientsResponse.StatusCode}. Body: {clientsResponseBody}");

        var clientsPayload = await ReadJsonElementAsync(clientsResponse);
        var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
        var warningClient = FindById(clients, seeded.WarningClientId);
        Assert.False(warningClient.ValueKind == JsonValueKind.Undefined);
        Assert.True(HasMembershipWarning(warningClient), "Expected warning signal in client payload.");

        using var markResponse = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = pastTrainingDateString,
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

        using (var clientsResponse = await client.GetAsync(
                   $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={trainingDateString}"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clients = GetArrayPayload(clientsPayload, "data", "items", "clients");
            var professionalClient = FindById(clients, seeded.ProfessionalClientId);
            Assert.False(professionalClient.ValueKind == JsonValueKind.Undefined);
            Assert.True(GetBoolFromAnyCase(professionalClient, "isProfessional", "IsProfessional"));
            Assert.False(HasMembershipWarning(professionalClient), "Professional client must not have membership warning.");
            Assert.False(GetBoolFromAnyCase(professionalClient, "hasUnpaidCurrentMembership", "HasUnpaidCurrentMembership"));
            Assert.True(GetBoolFromAnyCase(professionalClient, "hasActivePaidMembership", "HasActivePaidMembership"));
        }

        var operationStartedAt = DateTimeOffset.UtcNow;
        using var markResponse = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = trainingDateString,
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

        using (var rosterResponse = await client.GetAsync(
                   $"/attendance/groups/{seeded.AssignedGroupId}/clients?trainingDate={dateText}"))
        {
            var roster = await ReadJsonElementAsync(rosterResponse);
            Assert.Equal(dateText, roster.GetProperty("today").GetString());
            Assert.Equal("Unmarked", FindById(roster.GetProperty("clients"), seeded.SingleVisitClientId).GetProperty("state").GetString());
        }

        await SaveStateAsync(client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Present", session.CsrfToken);

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

        await SaveStateAsync(client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Present", session.CsrfToken);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var unchanged = await db.Attendance.SingleAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId);
            Assert.Equal(markedAt, unchanged.MarkedAt);
            Assert.Equal(membershipVersionCount, await db.ClientMemberships.CountAsync(candidate => candidate.ClientId == seeded.SingleVisitClientId));
            Assert.Equal(auditCount, await db.AuditLogs.CountAsync());
        }

        await SaveStateAsync(client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Absent", session.CsrfToken);

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

        await SaveStateAsync(client, seeded.AssignedGroupId, seeded.SingleVisitClientId, dateText, "Unmarked", session.CsrfToken);
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
                client, seeded.AssignedGroupId, seeded.SingleVisitClientId, today.ToString("yyyy-MM-dd"), invalidState, session.CsrfToken);
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            var invalidProblem = await ReadJsonElementAsync(invalid);
            Assert.True(invalidProblem.GetProperty("errors").TryGetProperty("attendanceMarks", out _));
        }

        using var future = await PostStateAsync(
            client, seeded.AssignedGroupId, seeded.SingleVisitClientId, today.AddDays(1).ToString("yyyy-MM-dd"), "Present", session.CsrfToken);
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
        await SaveStateAsync(client, seeded.AssignedGroupId, seeded.SingleVisitClientId, date, "Present", session.CsrfToken);

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
            var writtenOff = await db.ClientMemberships.SingleAsync(candidate => candidate.Id == provenanceMembershipId);
            var now = DateTimeOffset.UtcNow;
            writtenOff.ValidTo = now;
            conflictingMembershipId = Guid.NewGuid();
            db.ClientMemberships.Add(new ClientMembership
            {
                Id = conflictingMembershipId,
                ClientId = writtenOff.ClientId,
                SaleId = writtenOff.SaleId,
                MembershipType = writtenOff.MembershipType,
                PurchaseDate = writtenOff.PurchaseDate,
                ExpirationDate = writtenOff.ExpirationDate,
                PaymentAmount = writtenOff.PaymentAmount,
                IsPaid = writtenOff.IsPaid,
                SingleVisitUsed = writtenOff.SingleVisitUsed,
                PaidByUserId = writtenOff.PaidByUserId,
                PaidAt = writtenOff.PaidAt,
                ChangeReason = ClientMembershipChangeReason.Correction,
                ChangedByUserId = seeded.HeadCoachId,
                ValidFrom = now,
                CreatedAt = now
            });
            await db.SaveChangesAsync();
            auditCount = await db.AuditLogs.CountAsync();
        }

        using var conflict = await PostJsonAsync(
            client,
            $"/attendance/groups/{seeded.AssignedGroupId}",
            new
            {
                TrainingDate = date,
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
        HttpClient client,
        Guid groupId,
        Guid clientId,
        string date,
        string state,
        string csrfToken)
    {
        using var response = await PostStateAsync(client, groupId, clientId, date, state, csrfToken);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Expected success, got {response.StatusCode}. Body: {body}");
    }

    private static Task<HttpResponseMessage> PostStateAsync(
        HttpClient client,
        Guid groupId,
        Guid clientId,
        string date,
        string state,
        string csrfToken) =>
        PostJsonAsync(client, $"/attendance/groups/{groupId}", new
        {
            TrainingDate = date,
            AttendanceMarks = new[] { new { ClientId = clientId, State = state } }
        }, csrfToken);

    private static async Task<SeededAttendanceData> SeedAttendanceDataAsync(AttendanceAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        await dbContext.Database.EnsureCreatedAsync();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage7-password";

        var headCoach = CreateUser("headcoach-stage7", "Главный тренер Stage 7", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
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
            IsProfessional = true,
            ProfessionalComment = "Льготный статус для посещаемости",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.Branches.Add(branch);
        dbContext.Halls.AddRange(assignedHall, unassignedHall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(assignedGroup, unassignedGroup);
        dbContext.Clients.AddRange(warningClient, singleVisitClient, professionalClient);
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = assignedGroup.Id,
            TrainerId = coach.Id
        });
        await dbContext.SaveChangesAsync();

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

        await AddMembershipAsync(
            dbContext,
            warningClient.Id,
            coach.Id,
            MembershipType.Monthly,
            GetBusinessToday().AddMonths(-2),
            GetBusinessToday().AddDays(-1),
            1200m,
            isPaid: false,
            singleVisitUsed: false,
            seedBy: coach.Id);

        await AddMembershipAsync(
            dbContext,
            singleVisitClient.Id,
            coach.Id,
            MembershipType.SingleVisit,
            GetBusinessToday(),
            null,
            500m,
            isPaid: true,
            singleVisitUsed: false,
            seedBy: coach.Id);

        await AddMembershipAsync(
            dbContext,
            professionalClient.Id,
            coach.Id,
            MembershipType.SingleVisit,
            GetBusinessToday(),
            null,
            500m,
            isPaid: true,
            singleVisitUsed: false,
            seedBy: coach.Id);

        await dbContext.SaveChangesAsync();

        return new SeededAttendanceData(
            headCoach.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            assignedGroup.Id,
            unassignedGroup.Id,
            warningClient.Id,
            singleVisitClient.Id,
            professionalClient.Id);
    }

    private static async Task AddMembershipAsync(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid changedByUserId,
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool isPaid,
        bool singleVisitUsed,
        Guid seedBy)
    {
        var now = DateTimeOffset.UtcNow;
        var saleId = Guid.NewGuid();
        dbContext.ClientMemberships.Add(new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = saleId,
            MembershipType = membershipType,
            PurchaseDate = purchaseDate,
            ExpirationDate = expirationDate,
            PaymentAmount = paymentAmount,
            IsPaid = isPaid,
            SingleVisitUsed = singleVisitUsed,
            ChangedByUserId = changedByUserId,
            PaidByUserId = isPaid ? seedBy : null,
            PaidAt = isPaid ? now : null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ValidFrom = now,
            CreatedAt = now,
            Sale = new ClientMembershipSale
            {
                Id = saleId,
                ClientId = clientId,
                MembershipType = membershipType,
                PurchaseDate = purchaseDate,
                GrossAmount = paymentAmount,
                CreatedByUserId = changedByUserId,
                CreatedAt = now
            }
        });

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

        var isPaid = GetBoolFromAnyCase(clientPayload, "isPaid", "paid");
        if (isPaid is false)
        {
            return true;
        }

        var membershipPayload = GetPropertyOrNull(clientPayload, "currentMembership", "membership", "membershipData");
        if (membershipPayload.ValueKind == JsonValueKind.Object)
        {
            var membershipIsPaid = GetBoolFromAnyCase(
                membershipPayload,
                "isPaid",
                "paid",
                "isActive");
            if (membershipIsPaid is false)
            {
                return true;
            }

            var singleVisitUsed = GetBoolFromAnyCase(
                membershipPayload,
                "singleVisitUsed",
                "singleVisitHasBeenUsed");
            if (singleVisitUsed is true && GetStringFromAnyCase(membershipPayload, "membershipType", "type") == "SingleVisit")
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
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid AssignedGroupId,
        Guid UnassignedGroupId,
        Guid WarningClientId,
        Guid SingleVisitClientId,
        Guid ProfessionalClientId);

    private sealed class AttendanceAppFactory(bool useSqlite = false, bool throwAudit = false) : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-stage7",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 7"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                if (useSqlite)
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
