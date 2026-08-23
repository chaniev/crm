using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class GroupTrainerSubstitutionAccessMatrixTests
{
    private const string Password = "substitution-access-matrix-password";
    private const string BotToken = "substitution-access-matrix-bot-token";
    private static readonly DateOnly SubstitutionStartsOn = new(2026, 7, 24);
    private static readonly DateOnly SubstitutionEndsOn = new(2026, 7, 26);

    [Theory]
    [InlineData("2026-07-23", false)]
    [InlineData("2026-07-24", false)]
    [InlineData("2026-07-25", false)]
    [InlineData("2026-07-26", false)]
    [InlineData("2026-07-27", false)]
    public async Task Effective_scope_is_bound_to_business_date_and_controls_client_attendance_bot_and_photo_access(
        string businessDateText,
        bool shouldHaveMainGroupAccess)
    {
        var businessDate = DateOnly.Parse(businessDateText);
        var attendanceSaveDate = businessDate.AddDays(-1).ToString("yyyy-MM-dd");
        await using var factory = new SubstitutionAccessMatrixAppFactory(businessDate);
        var seeded = await SeedAccessMatrixDataAsync(factory);

        using var substituteClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var botClient = factory.CreateClient();
        botClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", BotToken);

        var substituteSession = await LoginAsync(substituteClient, "substitute-access-matrix");

        Assert.NotNull(substituteSession.User);
        Assert.Equal(shouldHaveMainGroupAccess, substituteSession.User.AssignedGroupIds.Contains(seeded.MainGroupId.ToString()));
        Assert.Contains(seeded.PermanentGroupId.ToString(), substituteSession.User.AssignedGroupIds);
        Assert.DoesNotContain(seeded.UnrelatedGroupId.ToString(), substituteSession.User.AssignedGroupIds);

        using var permanentAccessResponse = await PostWithoutBodyAsync(substituteClient, $"/access/attendance/{seeded.PermanentGroupId}", substituteSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, permanentAccessResponse.StatusCode);

        using var mainAccessResponse = await PostWithoutBodyAsync(substituteClient, $"/access/attendance/{seeded.MainGroupId}", substituteSession.CsrfToken);
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, mainAccessResponse.StatusCode);
        }
        else
        {
            await AssertAttendanceGroupForbiddenProblemAsync(mainAccessResponse);
        }

        using var attendanceGroupsResponse = await substituteClient.GetAsync("/attendance/groups");
        Assert.Equal(HttpStatusCode.OK, attendanceGroupsResponse.StatusCode);
        var attendanceGroupsPayload = await ReadJsonElementAsync(attendanceGroupsResponse);
        var attendanceGroups = GetArrayPayload(attendanceGroupsPayload, "data", "items", "groups").EnumerateArray().ToArray();
        var attendanceGroupIds = attendanceGroups.Select(group => GetGuidFromProperty(group, "id")).ToArray();
        Assert.Contains(seeded.PermanentGroupId, attendanceGroupIds);
        Assert.DoesNotContain(seeded.UnrelatedGroupId, attendanceGroupIds);
        if (shouldHaveMainGroupAccess)
        {
            Assert.Contains(seeded.MainGroupId, attendanceGroupIds);
        }
        else
        {
            Assert.DoesNotContain(seeded.MainGroupId, attendanceGroupIds);
        }

        using var clientListResponse = await substituteClient.GetAsync(
            $"/clients?groupId={seeded.MainGroupId}&quickFilters=WithoutMembership");
        Assert.Equal(HttpStatusCode.OK, clientListResponse.StatusCode);
        var clientListPayload = await ReadJsonElementAsync(clientListResponse);
        var clientItems = GetArrayPayload(clientListPayload, "items", "clients");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Contains(
                clientItems.EnumerateArray(),
                client => GetGuidFromProperty(client, "id") == seeded.MainClientId);
            Assert.Equal(1, GetLongFromAnyCase(
                GetPropertyOrNull(clientListPayload, "quickFilterCounts", "QuickFilterCounts"),
                "withoutMembership",
                "WithoutMembership"));
        }
        else
        {
            Assert.Empty(clientItems.EnumerateArray());
            Assert.Equal(0, GetLongFromAnyCase(
                GetPropertyOrNull(clientListPayload, "quickFilterCounts", "QuickFilterCounts"),
                "withoutMembership",
                "WithoutMembership"));
        }

        using var clientDetailsResponse = await substituteClient.GetAsync($"/clients/{seeded.MainClientId}");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, clientDetailsResponse.StatusCode);
            var clientPayload = await ReadJsonElementAsync(clientDetailsResponse);
            Assert.Equal(string.Empty, GetStringFromProperty(clientPayload, "phone", "Phone"));

            var contactsPayload = GetPropertyOrNull(clientPayload, "contacts", "Contacts");
            Assert.Equal(0, contactsPayload.ValueKind == JsonValueKind.Array ? contactsPayload.GetArrayLength() : 0);

            var attendanceHistory = GetArrayPayloadOrEmpty(
                clientPayload,
                "attendanceHistory",
                "AttendanceHistory",
                "attendanceHistoryItems",
                "AttendanceHistoryItems");
            Assert.Single(attendanceHistory);
        }
        else
        {
            await AssertForbiddenProblemAsync(clientDetailsResponse);
        }

        using var photoResponse = await substituteClient.GetAsync($"/clients/{seeded.MainClientId}/photo");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, photoResponse.StatusCode);
        }
        else
        {
            await AssertForbiddenProblemAsync(photoResponse);
        }

        using var rosterResponse = await substituteClient.GetAsync(
            $"/attendance/groups/{seeded.MainGroupId}/clients?trainingDate={attendanceSaveDate}");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, rosterResponse.StatusCode);
            var rosterPayload = await ReadJsonElementAsync(rosterResponse);
            var rosterClients = GetArrayPayload(rosterPayload, "clients", "items");
            Assert.Contains(
                rosterClients.EnumerateArray(),
                client => GetGuidFromProperty(client, "id") == seeded.MainClientId);
        }
        else
        {
            await AssertAttendanceGroupForbiddenProblemAsync(rosterResponse);
        }

        using var saveResponse = await PostAttendanceStateAsync(
            substituteClient,
            seeded.MainGroupId,
            seeded.MainClientId,
            attendanceSaveDate,
            "Present",
            substituteSession.CsrfToken);
        if (shouldHaveMainGroupAccess)
        {
            Assert.True(saveResponse.IsSuccessStatusCode);
        }
        else
        {
            await AssertAttendanceGroupForbiddenProblemAsync(saveResponse);
        }

        using var botAttendanceGroupsResponse = await SendBotRequestAsync(
            botClient,
            HttpMethod.Get,
            $"/internal/bot/attendance/groups?platform=Telegram&platformUserId={seeded.SubstituteTelegramId}");
        Assert.Equal(HttpStatusCode.OK, botAttendanceGroupsResponse.StatusCode);
        var botAttendanceGroupsPayload = await ReadJsonElementAsync(botAttendanceGroupsResponse);
        var botGroups = GetArrayPayload(botAttendanceGroupsPayload).EnumerateArray().ToArray();
        var botGroupIds = botGroups.Select(group => GetGuidFromProperty(group, "id")).ToArray();
        Assert.Contains(seeded.PermanentGroupId, botGroupIds);
        Assert.DoesNotContain(seeded.UnrelatedGroupId, botGroupIds);
        if (shouldHaveMainGroupAccess)
        {
            Assert.Contains(seeded.MainGroupId, botGroupIds);
        }
        else
        {
            Assert.DoesNotContain(seeded.MainGroupId, botGroupIds);
        }

        using var botRosterResponse = await SendBotRequestAsync(
            botClient,
            HttpMethod.Get,
            $"/internal/bot/attendance/groups/{seeded.MainGroupId}/clients" +
            $"?platform=Telegram&platformUserId={seeded.SubstituteTelegramId}&trainingDate={attendanceSaveDate}");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, botRosterResponse.StatusCode);
        }
        else
        {
            AssertForbiddenOrNotFound(botRosterResponse);
        }

        using var botSaveResponse = await SendBotRequestAsync(
            botClient,
            HttpMethod.Post,
            $"/internal/bot/attendance/groups/{seeded.MainGroupId}",
            new BotSaveAttendanceRequest(
                "Telegram",
                seeded.SubstituteTelegramId,
                attendanceSaveDate,
                [new BotAttendanceMarkRequest(seeded.MainClientId, true)]),
            idempotencyKey: "matrix-save");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, botSaveResponse.StatusCode);
        }
        else
        {
            AssertForbiddenOrNotFound(botSaveResponse);
        }

        using var botSearchResponse = await SendBotRequestAsync(
            botClient,
            HttpMethod.Get,
            $"/internal/bot/clients?q=Scoped&platform=Telegram&platformUserId={seeded.SubstituteTelegramId}");
        Assert.Equal(HttpStatusCode.OK, botSearchResponse.StatusCode);
        var botSearchPayload = await ReadJsonElementAsync(botSearchResponse);
        var botSearchItems = GetArrayPayload(botSearchPayload, "items").EnumerateArray();
        Assert.Equal(shouldHaveMainGroupAccess, botSearchItems.Any(client => GetGuidFromProperty(client, "id") == seeded.MainClientId));

        using var botCardResponse = await SendBotRequestAsync(
            botClient,
            HttpMethod.Get,
            $"/internal/bot/clients/{seeded.MainClientId}?platform=Telegram&platformUserId={seeded.SubstituteTelegramId}");
        if (shouldHaveMainGroupAccess)
        {
            Assert.Equal(HttpStatusCode.OK, botCardResponse.StatusCode);
        }
        else
        {
            AssertForbiddenOrNotFound(botCardResponse);
        }

        using var scheduleResponse = await substituteClient.GetAsync("/schedule/groups");
        Assert.Equal(HttpStatusCode.OK, scheduleResponse.StatusCode);
        var schedulePayload = await ReadJsonElementAsync(scheduleResponse);
        var scheduleItems = GetArrayPayload(schedulePayload, "items");
        var scheduleGroupIds = scheduleItems
            .EnumerateArray()
            .Select(item => GetGuidFromProperty(item, "id"))
            .ToHashSet();
        Assert.Equal(shouldHaveMainGroupAccess ? 2 : 1, schedulePayload.GetProperty("totalCount").GetInt32());
        Assert.Equal(shouldHaveMainGroupAccess ? 2 : 1, scheduleItems.GetArrayLength());
        Assert.Contains(seeded.PermanentGroupId, scheduleGroupIds);
        Assert.DoesNotContain(seeded.UnrelatedGroupId, scheduleGroupIds);
        if (shouldHaveMainGroupAccess)
        {
            Assert.Contains(seeded.MainGroupId, scheduleGroupIds);
        }
        else
        {
            Assert.DoesNotContain(seeded.MainGroupId, scheduleGroupIds);
        }
    }

    [Fact]
    public async Task Legacy_substitution_never_grants_temporary_scope_and_legacy_cancel_route_is_absent()
    {
        var attendanceSaveDate = SubstitutionStartsOn.AddDays(-1).ToString("yyyy-MM-dd");
        await using var factory = new SubstitutionAccessMatrixAppFactory(SubstitutionStartsOn);
        var seeded = await SeedAccessMatrixDataAsync(factory);

        using var substituteBeforeClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var substituteSession = await LoginAsync(substituteBeforeClient, "substitute-access-matrix");

        Assert.NotNull(substituteSession.User);
        Assert.DoesNotContain(seeded.MainGroupId.ToString(), substituteSession.User.AssignedGroupIds);

        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var managerSession = await LoginAsync(managerClient, "headcoach-access-matrix");

        using var cancelResponse = await PostWithoutBodyAsync(
            managerClient,
            $"/groups/{seeded.MainGroupId}/trainer-substitutions/{seeded.ActiveSubstitutionId}/cancel",
            managerSession.CsrfToken);
        AssertLegacyMutationRouteAbsent(cancelResponse);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var substitution = await dbContext.GroupTrainerSubstitutions.SingleAsync(
                substitution => substitution.Id == seeded.ActiveSubstitutionId);
            Assert.Null(substitution.CancelledAt);
        }

        using var substituteAfterClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var substituteAfterSession = await LoginAsync(substituteAfterClient, "substitute-access-matrix");

        Assert.NotNull(substituteAfterSession.User);
        Assert.DoesNotContain(seeded.MainGroupId.ToString(), substituteAfterSession.User.AssignedGroupIds);
        Assert.Contains(seeded.PermanentGroupId.ToString(), substituteAfterSession.User.AssignedGroupIds);

        using var afterAccessMain = await PostWithoutBodyAsync(substituteAfterClient, $"/access/attendance/{seeded.MainGroupId}", substituteAfterSession.CsrfToken);
        await AssertAttendanceGroupForbiddenProblemAsync(afterAccessMain);

        using var afterAttendanceGroups = await substituteAfterClient.GetAsync("/attendance/groups");
        var afterAttendanceGroupsPayload = await ReadJsonElementAsync(afterAttendanceGroups);
        var afterGroups = GetArrayPayload(afterAttendanceGroupsPayload, "data", "items", "groups").EnumerateArray().ToArray();
        var afterGroupIds = afterGroups.Select(group => GetGuidFromProperty(group, "id")).ToArray();
        Assert.Contains(seeded.PermanentGroupId, afterGroupIds);
        Assert.DoesNotContain(seeded.MainGroupId, afterGroupIds);

        using var afterClientResponse = await substituteAfterClient.GetAsync($"/clients/{seeded.MainClientId}");
        await AssertForbiddenProblemAsync(afterClientResponse);

        using var afterRosterResponse = await substituteAfterClient.GetAsync(
            $"/attendance/groups/{seeded.MainGroupId}/clients?trainingDate={attendanceSaveDate}");
        await AssertAttendanceGroupForbiddenProblemAsync(afterRosterResponse);

        using var reportManagerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var seededFinancial = await SeedFinancialAttributionAsync(factory);
        _ = await LoginAsync(reportManagerClient, "headcoach-report-matrix");
        using var reportResponse = await reportManagerClient.GetAsync("/reports/financial?periodPreset=month&anchorDate=2026-07-14");
        Assert.Equal(HttpStatusCode.OK, reportResponse.StatusCode);

        var reportPayload = await ReadJsonElementAsync(reportResponse);
        var trainerBreakdown = reportPayload.GetProperty("trainerBreakdown").EnumerateArray().ToArray();
        Assert.Contains(
            trainerBreakdown,
            row => GetGuidFromProperty(row, "trainerId") == seededFinancial.HeadCoachId);
        Assert.DoesNotContain(
            trainerBreakdown,
            row => GetGuidFromProperty(row, "trainerId") == seededFinancial.SubstituteCoachId);
    }

    private static async Task<SeededAccessMatrixData> SeedAccessMatrixDataAsync(SubstitutionAccessMatrixAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = new DateTimeOffset(2026, 7, 20, 10, 0, 0, TimeSpan.Zero);

        var branchId = Guid.NewGuid();
        var hallId = Guid.NewGuid();
        var hallSecondaryId = Guid.NewGuid();
        var groupTypeId = Guid.NewGuid();
        var mainGroupId = Guid.NewGuid();
        var permanentGroupId = Guid.NewGuid();
        var unrelatedGroupId = Guid.NewGuid();

        var headCoachId = Guid.NewGuid();
        var substituteCoachId = Guid.NewGuid();

        var mainClientId = Guid.NewGuid();
        var permanentClientId = Guid.NewGuid();
        var substitutionId = Guid.NewGuid();
        var photoPath = $"{mainClientId:N}.jpg";

        Directory.CreateDirectory(factory.PhotoStorageRootPath);
        await File.WriteAllBytesAsync(Path.Combine(factory.PhotoStorageRootPath, photoPath), [0xFF, 0xD8, 0xFF, 0xD9]);

        dbContext.Branches.Add(new Branch
        {
            Id = branchId,
            Name = "Matrix Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Halls.AddRange(
            new Hall
            {
                Id = hallId,
                BranchId = branchId,
                Name = "Matrix Hall Main",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            },
            new Hall
            {
                Id = hallSecondaryId,
                BranchId = branchId,
                Name = "Matrix Hall Permanent",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            });

        dbContext.GroupTypes.Add(new GroupType
        {
            Id = groupTypeId,
            Name = "Matrix Group Type",
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Users.AddRange(
            CreateUser(
                "headcoach-access-matrix",
                "Главный тренер Matrix",
                UserRole.HeadCoach,
                passwordHashService,
                now,
                headCoachId),
            CreateUser(
                "substitute-access-matrix",
                "Substitute Matrix",
                UserRole.Coach,
                passwordHashService,
                now,
                substituteCoachId,
                telegramId: "matrix-substitute-telegram"));

        var mainGroup = new TrainingGroup
        {
            Id = mainGroupId,
            BranchId = branchId,
            HallId = hallId,
            GroupTypeId = groupTypeId,
            Name = "Scoped Main Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var permanentGroup = new TrainingGroup
        {
            Id = permanentGroupId,
            BranchId = branchId,
            HallId = hallSecondaryId,
            GroupTypeId = groupTypeId,
            Name = "Matrix Permanent Group",
            TrainingStartTime = new TimeOnly(11, 0),
            DurationMinutes = 60,
            Weekdays = [2, 4],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var unrelatedGroup = new TrainingGroup
        {
            Id = unrelatedGroupId,
            BranchId = branchId,
            HallId = hallSecondaryId,
            GroupTypeId = groupTypeId,
            Name = "Matrix Unrelated Group",
            TrainingStartTime = new TimeOnly(12, 0),
            DurationMinutes = 60,
            Weekdays = [5],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.TrainingGroups.AddRange(mainGroup, permanentGroup, unrelatedGroup);

        dbContext.GroupTrainers.AddRange(
            new GroupTrainer { GroupId = mainGroupId, TrainerId = headCoachId },
            new GroupTrainer { GroupId = permanentGroupId, TrainerId = substituteCoachId });

        dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = substitutionId,
            GroupId = mainGroupId,
            SubstituteTrainerId = substituteCoachId,
            StartsOn = SubstitutionStartsOn,
            EndsOn = SubstitutionEndsOn,
            CreatedByUserId = headCoachId,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Clients.AddRange(
            new Client
            {
                Id = mainClientId,
                BranchId = branchId,
                LastName = "Scoped",
                FirstName = "Main",
                Phone = "+79990000001",
                PhotoPath = photoPath,
                PhotoContentType = "image/jpeg",
                PhotoSizeBytes = 4,
                PhotoUploadedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            },
            new Client
            {
                Id = permanentClientId,
                BranchId = branchId,
                LastName = "Scoped",
                FirstName = "Permanent",
                Phone = "+79990000002",
                CreatedAt = now,
                UpdatedAt = now
            });

        dbContext.ClientGroups.AddRange(
            new ClientGroup
            {
                ClientId = mainClientId,
                GroupId = mainGroupId,
                BranchId = branchId
            },
            new ClientGroup
            {
                ClientId = permanentClientId,
                GroupId = permanentGroupId,
                BranchId = branchId
            });

        dbContext.Attendance.AddRange(
            CreateAttendance(mainClientId, mainGroupId, headCoachId, new DateOnly(2026, 7, 18), true),
            CreateAttendance(permanentClientId, permanentGroupId, headCoachId, new DateOnly(2026, 7, 18), false));

        await dbContext.SaveChangesAsync();

        return new SeededAccessMatrixData(
            mainGroupId,
            permanentGroupId,
            unrelatedGroupId,
            headCoachId,
            substituteCoachId,
            mainClientId,
            permanentClientId,
            substitutionId,
            substituteCoachId,
            "matrix-substitute-telegram");
    }

    private static Attendance CreateAttendance(
        Guid clientId,
        Guid groupId,
        Guid markedByUserId,
        DateOnly trainingDate,
        bool isPresent)
    {
        var now = DateTimeOffset.UtcNow;
        return new Attendance
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            GroupId = groupId,
            TrainingDate = trainingDate,
            IsPresent = isPresent,
            MarkedByUserId = markedByUserId,
            MarkedAt = now,
            UpdatedAt = now
        };
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login)
    {
        using var sessionResponse = await client.GetAsync("/auth/session");
        var initialSession = await ReadJsonAsync<SessionPayload>(sessionResponse);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, Password),
            initialSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return await ReadJsonAsync<SessionPayload>(loginResponse);
    }

    private static async Task AssertAttendanceGroupForbiddenProblemAsync(HttpResponseMessage response)
    {
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return;
        }

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("/problems/attendance-group-forbidden", payload.GetProperty("type").GetString());
    }

    private static async Task AssertForbiddenProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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

    private static async Task<HttpResponseMessage> PostAttendanceStateAsync(
        HttpClient client,
        Guid groupId,
        Guid clientId,
        string trainingDate,
        string state,
        string csrfToken)
    {
        return await PostJsonAsync(
            client,
            $"/attendance/groups/{groupId}",
            new
            {
                TrainingDate = trainingDate,
                AttendanceMarks = new[]
                {
                    new
                    {
                        ClientId = clientId,
                        State = state
                    }
                }
            },
            csrfToken);
    }

    private static async Task<HttpResponseMessage> SendBotRequestAsync(
        HttpClient client,
        HttpMethod method,
        string url,
        object? body = null,
        string? idempotencyKey = null,
        bool includeIdempotencyHeader = true)
    {
        using var request = new HttpRequestMessage(method, url);

        if (includeIdempotencyHeader && !string.IsNullOrWhiteSpace(idempotencyKey))
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    private static async Task<SeededFinancialAttributionData> SeedFinancialAttributionAsync(SubstitutionAccessMatrixAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = new DateTimeOffset(2026, 7, 14, 12, 0, 0, TimeSpan.Zero);

        var headCoachId = Guid.NewGuid();
        var substituteCoachId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var hallId = Guid.NewGuid();
        var groupTypeId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        dbContext.Users.AddRange(
            CreateUser(
                "headcoach-report-matrix",
                "Главный тренер Matrix Reports",
                UserRole.HeadCoach,
                passwordHashService,
                now,
                headCoachId),
            CreateUser(
                "substitute-report-matrix",
                "Субститут Matrix Reports",
                UserRole.Coach,
                passwordHashService,
                now,
                substituteCoachId));

        dbContext.Branches.Add(new Branch
        {
            Id = branchId,
            Name = "Matrix Report Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Halls.Add(new Hall
        {
            Id = hallId,
            BranchId = branchId,
            Name = "Matrix Report Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.GroupTypes.Add(new GroupType
        {
            Id = groupTypeId,
            Name = "Matrix Report Group Type",
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.TrainingGroups.Add(new TrainingGroup
        {
            Id = groupId,
            BranchId = branchId,
            HallId = hallId,
            GroupTypeId = groupTypeId,
            Name = "Matrix Report Group",
            TrainingStartTime = new TimeOnly(18, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Clients.Add(new Client
        {
            Id = clientId,
            BranchId = branchId,
            LastName = "Report",
            FirstName = "Scoped",
            Phone = "+79990000003",
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.ClientBranchAssignments.Add(new ClientBranchAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BranchId = branchId,
            ValidFrom = new DateOnly(2026, 7, 1),
            ValidTo = null,
            CreatedByUserId = headCoachId,
            CreatedAt = now
        });

        dbContext.ClientGroupAssignments.Add(new ClientGroupAssignment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            GroupId = groupId,
            ValidFrom = new DateOnly(2026, 7, 1),
            ValidTo = null,
            CreatedByUserId = headCoachId,
            CreatedAt = now
        });

        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TrainerId = headCoachId,
            ValidFrom = new DateOnly(2026, 7, 1),
            ValidTo = null,
            CreatedByUserId = headCoachId,
            CreatedAt = now
        });

        dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = substituteCoachId,
            StartsOn = SubstitutionStartsOn,
            EndsOn = SubstitutionEndsOn,
            CreatedByUserId = headCoachId,
            CreatedAt = now,
            UpdatedAt = now
        });

        var saleId = Guid.NewGuid();
        dbContext.ClientMembershipSales.Add(new ClientMembershipSale
        {
            Id = saleId,
            ClientId = clientId,
            BehaviorKind = MembershipBehaviorKind.Term,
            PricingMode = ClientMembershipSalePricingMode.AmountOnly,
            PurchaseDate = new DateOnly(2026, 7, 14),
            PaymentDate = new DateOnly(2026, 7, 14),
            GrossAmount = 1000m,
            CreatedByUserId = headCoachId,
            CreatedAt = now
        });
        dbContext.ClientMembershipSaleTargetSnapshots.Add(new ClientMembershipSaleTargetSnapshot
        {
            SaleId = saleId,
            GroupId = groupId,
            BranchId = branchId,
            Position = 0,
            Provenance = "Write"
        });

        await dbContext.SaveChangesAsync();
        return new SeededFinancialAttributionData(headCoachId, substituteCoachId);
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        IPasswordHashService passwordHashService,
        DateTimeOffset now,
        Guid? id = null,
        Guid? branchId = null,
        string? telegramId = null)
    {
        var user = new User
        {
            Id = id ?? Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = role,
            BranchId = branchId,
            MessengerPlatform = telegramId is null ? null : MessengerPlatform.Telegram,
            MessengerPlatformUserId = telegramId,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, Password);
        return user;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload;
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

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(HttpClient client, string path, string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static JsonElement GetArrayPayload(JsonElement payload, params string[] alternativeNames)
    {
        if (payload.ValueKind == JsonValueKind.Array)
        {
            return payload;
        }

        foreach (var name in alternativeNames)
        {
            if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty(name, out var data) && data.ValueKind == JsonValueKind.Array)
            {
                return data;
            }
        }

        return payload;
    }

    private static IReadOnlyList<JsonElement> GetArrayPayloadOrEmpty(JsonElement payload, params string[] alternativeNames)
    {
        var items = GetArrayPayload(payload, alternativeNames);
        return items.ValueKind == JsonValueKind.Array
            ? items.EnumerateArray().ToList()
            : [];
    }

    private static JsonElement GetPropertyOrNull(JsonElement payload, params string[] propertyNames)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return default;
        }

        foreach (var propertyName in propertyNames)
        {
            if (payload.TryGetProperty(propertyName, out var propertyValue))
            {
                return propertyValue;
            }
        }

        return default;
    }

    private static long GetLongFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return 0;
        }

        foreach (var propertyName in propertyNames)
        {
            if (payload.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number)
                {
                    return value.GetInt64();
                }

                if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out var longValue))
                {
                    return longValue;
                }
            }
        }

        return 0;
    }

    private static Guid GetGuidFromProperty(JsonElement payload, params string[] propertyNames)
    {
        foreach (var name in propertyNames)
        {
            if (payload.TryGetProperty(name, out var value))
            {
                return value.GetGuid();
            }
        }

        throw new InvalidOperationException($"Expected guid property '{string.Join("', '", propertyNames)}' not found.");
    }

    private static string GetStringFromProperty(JsonElement payload, params string[] propertyNames)
    {
        foreach (var name in propertyNames)
        {
            if (payload.TryGetProperty(name, out var value))
            {
                return value.GetString() ?? string.Empty;
            }
        }

        return string.Empty;
    }

    private sealed record SeededAccessMatrixData(
        Guid MainGroupId,
        Guid PermanentGroupId,
        Guid UnrelatedGroupId,
        Guid HeadCoachId,
        Guid SubstituteCoachId,
        Guid MainClientId,
        Guid PermanentClientId,
        Guid ActiveSubstitutionId,
        Guid SubstituteTrainerId,
        string SubstituteTelegramId);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(string Id, string Role, string[] AssignedGroupIds);

    private sealed record LoginRequest(string Login, string Password);


    private sealed record BotAttendanceMarkRequest(Guid ClientId, bool IsPresent);

    private sealed record BotSaveAttendanceRequest(
        string Platform,
        string PlatformUserId,
        string TrainingDate,
        IReadOnlyList<BotAttendanceMarkRequest> AttendanceMarks);

    private sealed record SeededFinancialAttributionData(Guid HeadCoachId, Guid SubstituteCoachId);

    private sealed class SubstitutionAccessMatrixAppFactory(DateOnly businessDate) : WebApplicationFactory<Program>
    {
        public string PhotoStorageRootPath { get; } = Path.Combine(
            Path.GetTempPath(),
            $"gym-crm-substitution-matrix-photos-{Guid.NewGuid():N}");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-access-matrix",
                    ["BootstrapUser:FullName"] = "Bootstrap Access Matrix",
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

                var databaseName = $"gym-crm-substitution-access-matrix-{Guid.NewGuid():N}";
                services.AddDbContext<GymCrmDbContext>(options =>
                    options.UseInMemoryDatabase(databaseName).UseInternalServiceProvider(entityFrameworkProvider));

                services.RemoveAll<IBusinessDateProvider>();
                services.AddSingleton<IBusinessDateProvider>(new FixedBusinessDateProvider(businessDate));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);

            if (!disposing)
            {
                return;
            }

            if (Directory.Exists(PhotoStorageRootPath))
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
}
