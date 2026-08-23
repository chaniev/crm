using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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

public class AdministratorAttendanceGrantApiTests
{
    [Fact]
    public async Task Task080_administrator_grant_management_get_returns_summary_with_unavailable_stale_grant()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        var target = payload.GetProperty("target");
        Assert.Equal(seeded.AdministratorId, GetGuidFromProperty(target, "id"));
        Assert.True(target.GetProperty("isActive").GetBoolean());

        var branch = payload.GetProperty("branch");
        Assert.Equal(seeded.AssignedBranchId, GetGuidFromProperty(branch, "id"));

        var storedGrantIds = payload.GetProperty("grantedGroupIds").EnumerateArray()
            .Select(element => Guid.Parse(element.GetString()!))
            .OrderBy(value => value)
            .ToArray();
        Assert.Equal(2, storedGrantIds.Length);
        Assert.Equal(
            new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId }.OrderBy(id => id).ToArray(),
            storedGrantIds);
        Assert.Equal(2, payload.GetProperty("storedGrantCount").GetInt32());

        var groups = payload.GetProperty("groups").EnumerateArray().ToArray();
        var activeGroup = groups.Single(group => GetGuidFromProperty(group, "id") == seeded.ActiveGrantedGroupId);
        Assert.True(activeGroup.GetProperty("isGranted").GetBoolean());
        Assert.True(activeGroup.GetProperty("canGrant").GetBoolean());
        Assert.True(activeGroup.GetProperty("canRevoke").GetBoolean());
        Assert.True(activeGroup.GetProperty("disabledReason").ValueKind is JsonValueKind.Null or JsonValueKind.Undefined);

        var inactiveGroup = groups.Single(group => GetGuidFromProperty(group, "id") == seeded.InactiveBranchGroupId);
        Assert.False(inactiveGroup.GetProperty("isGranted").GetBoolean());
        Assert.False(inactiveGroup.GetProperty("canGrant").GetBoolean());
        Assert.Equal("inactive_group", inactiveGroup.GetProperty("disabledReason").GetString());

        var unavailable = payload.GetProperty("unavailableStoredGrants").EnumerateArray().ToArray();
        Assert.Single(unavailable);
        var staleGrant = unavailable[0];
        Assert.Equal(seeded.ForeignBranchStoredGroupId, GetGuidFromProperty(staleGrant, "groupId"));
        Assert.Equal(seeded.SecondBranchId, GetGuidFromProperty(staleGrant, "branchId"));
        Assert.False(staleGrant.GetProperty("canGrant").GetBoolean());
        Assert.True(staleGrant.GetProperty("canRevoke").GetBoolean());
        Assert.Equal("grant_scope_invalid", staleGrant.GetProperty("disabledReason").GetString());
    }

    [Fact]
    public async Task Task080_administrator_grant_put_validates_required_fields_duplicates_unknown_and_empty_values()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var missingPayloadResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new { },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, missingPayloadResponse.StatusCode);

        var missingErrors = await ReadValidationErrorsAsync(missingPayloadResponse);
        Assert.True(missingErrors.TryGetProperty("groupIds", out _));
        Assert.True(missingErrors.TryGetProperty("expectedGroupIds", out _));

        using var duplicateResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                GroupIds = new[]
                {
                    seeded.ActiveGrantedGroupId,
                    seeded.ActiveGrantedGroupId
                },
                ExpectedGroupIds = new[] { seeded.InactiveBranchGroupId }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        var duplicateErrors = await ReadValidationErrorsAsync(duplicateResponse);
        Assert.True(duplicateErrors.TryGetProperty("groupIds", out _));

        using var emptyGuidResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                GroupIds = new[] { Guid.Empty },
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, emptyGuidResponse.StatusCode);
        var emptyGuidErrors = await ReadValidationErrorsAsync(emptyGuidResponse);
        Assert.True(emptyGuidErrors.TryGetProperty("groupIds", out _));

        var unknownId = Guid.NewGuid();
        using var unknownResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                GroupIds = new[] { unknownId },
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.BadRequest, unknownResponse.StatusCode);
        var unknownErrors = await ReadValidationErrorsAsync(unknownResponse);
        Assert.True(unknownErrors.TryGetProperty("groupIds", out _));
    }

    [Fact]
    public async Task Task080_administrator_grant_put_is_cas_safe_and_skips_audit_on_noop_or_conflict()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var noOpResponse = await PutJsonAsync(
                   client,
                   $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
                   new
                   {
                       GroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                       ExpectedGroupIds = new[] { seeded.ActiveAlternateGroupId }
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, noOpResponse.StatusCode);
        }

        using var conflictResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                GroupIds = new[]
                {
                    seeded.ActiveGrantedGroupId,
                    seeded.ActiveAlternateGroupId,
                    seeded.ForeignBranchStoredGroupId
                },
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, conflictResponse.StatusCode);
        await AssertProblemDetailsAsync(
            conflictResponse,
            "/problems/attendance-grant-concurrency-conflict",
            "attendance_grant_concurrency_conflict");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var grants = await dbContext.AdministratorAttendanceGroupGrants
            .Where(grant => grant.AdministratorId == seeded.AdministratorId)
            .OrderBy(grant => grant.GroupId)
            .Select(grant => grant.GroupId)
            .ToArrayAsync();
        Assert.Equal(
            new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId }.OrderBy(id => id).ToArray(),
            grants);

        Assert.Empty(
            await dbContext.AuditLogs
                .Where(log => log.EntityType == "AdministratorAttendanceGroupGrant" &&
                    log.UserId == seeded.HeadCoachId)
                .ToListAsync());
    }

    [Fact]
    public async Task Task080_head_coach_and_super_administrator_can_manage_administrator_grant_scope()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var headCoachSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        using (var headCoachGet = await managerClient.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachGet.StatusCode);
        }

        using (var headCoachPut = await PutJsonAsync(
                   managerClient,
                   $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
                   new
                   {
                       GroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ActiveAlternateGroupId, seeded.ForeignBranchStoredGroupId },
                       ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId }
                   },
                   headCoachSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachPut.StatusCode);
        }

        var superAdminSession = await LoginAsync(managerClient, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        using (var superAdminGet = await managerClient.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.OK, superAdminGet.StatusCode);
        }

        using (var superAdminPut = await PutJsonAsync(
                   managerClient,
                   $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
                   new
                   {
                       GroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                       ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ActiveAlternateGroupId, seeded.ForeignBranchStoredGroupId }
                   },
                   superAdminSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, superAdminPut.StatusCode);
        }
    }

    [Fact]
    public async Task Task080_administrator_and_coach_are_forbidden_on_grant_management_endpoints()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var administratorSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        using (var getResponse = await client.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        }

        using (var putResponse = await PutJsonAsync(
                   client,
                   $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
                   new
                   {
                       GroupIds = new[] { seeded.ActiveAlternateGroupId },
                       ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
                   },
                   administratorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, putResponse.StatusCode);
        }

        var coachSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        using (var coachGetResponse = await client.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, coachGetResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Task080_grant_management_put_rejects_missing_and_invalid_csrf_token()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        var endpoint = $"/settings/administrators/{seeded.AdministratorId}/attendance-groups";
        using var request = new HttpRequestMessage(HttpMethod.Put, endpoint)
        {
            Content = JsonContent.Create(new
            {
                GroupIds = Array.Empty<Guid>(),
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
            })
        };
        using (var missingTokenResponse = await client.SendAsync(request))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingTokenResponse.StatusCode);
        }

        using var requestWithInvalidToken = new HttpRequestMessage(HttpMethod.Put, endpoint)
        {
            Content = JsonContent.Create(new
            {
                GroupIds = Array.Empty<Guid>(),
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId }
            })
        };
        requestWithInvalidToken.Headers.Add("X-CSRF-TOKEN", "invalid-token");
        using (var invalidTokenResponse = await client.SendAsync(requestWithInvalidToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalidTokenResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(
            2,
            await dbContext.AdministratorAttendanceGroupGrants
                .CountAsync(grant => grant.AdministratorId == seeded.AdministratorId));
    }

    [Fact]
    public async Task Task080_foreign_and_inactive_group_addition_prefers_branch_violation_before_inactive_resource()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        using var response = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                GroupIds = new[] { seeded.ForeignBranchCandidateGroupId, seeded.InactiveBranchGroupId }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("/problems/attendance-grant-branch-forbidden", payload.GetProperty("type").GetString());
        Assert.Equal("attendance_grant_branch_forbidden", payload.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Task080_head_coach_observes_archived_branch_restore_state_in_grant_management_response()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var beforeArchive = await managerClient.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.OK, beforeArchive.StatusCode);
            var beforePayload = await ReadJsonElementAsync(beforeArchive);
            var beforeGroups = beforePayload.GetProperty("groups").EnumerateArray().ToArray();
            var beforeActiveGroup = beforeGroups.Single(group => GetGuidFromProperty(group, "id") == seeded.ActiveGrantedGroupId);
            Assert.True(beforeActiveGroup.GetProperty("canGrant").GetBoolean());
            Assert.True(beforeActiveGroup.GetProperty("canRevoke").GetBoolean());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var assignedBranch = await dbContext.Branches.SingleAsync(branch => branch.Id == seeded.AssignedBranchId);
            assignedBranch.IsArchived = true;
            await dbContext.SaveChangesAsync();
        }

        using (var afterArchive = await managerClient.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.OK, afterArchive.StatusCode);
            var archivedPayload = await ReadJsonElementAsync(afterArchive);
            var archivedGroups = archivedPayload.GetProperty("groups").EnumerateArray().ToArray();
            var archivedActiveGroup = archivedGroups.Single(group => GetGuidFromProperty(group, "id") == seeded.ActiveGrantedGroupId);
            Assert.False(archivedActiveGroup.GetProperty("canGrant").GetBoolean());
            Assert.True(archivedActiveGroup.GetProperty("canRevoke").GetBoolean());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var assignedBranch = await dbContext.Branches.SingleAsync(branch => branch.Id == seeded.AssignedBranchId);
            assignedBranch.IsArchived = false;
            await dbContext.SaveChangesAsync();
        }

        using (var afterRestore = await managerClient.GetAsync($"/settings/administrators/{seeded.AdministratorId}/attendance-groups"))
        {
            Assert.Equal(HttpStatusCode.OK, afterRestore.StatusCode);
            var restoredPayload = await ReadJsonElementAsync(afterRestore);
            var restoredGroups = restoredPayload.GetProperty("groups").EnumerateArray().ToArray();
            var restoredActiveGroup = restoredGroups.Single(group => GetGuidFromProperty(group, "id") == seeded.ActiveGrantedGroupId);
            Assert.True(restoredActiveGroup.GetProperty("canGrant").GetBoolean());
            Assert.True(restoredActiveGroup.GetProperty("canRevoke").GetBoolean());
        }
    }

    [Fact]
    public async Task Task080_administrator_grant_put_writes_audit_per_grant_delta_and_revocation()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                GroupIds = new[] { seeded.ActiveAlternateGroupId, seeded.ForeignBranchStoredGroupId },
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId }
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var grantAuditLogs = await dbContext.AuditLogs
            .Where(log => log.EntityType == "AdministratorAttendanceGroupGrant" && log.UserId == seeded.HeadCoachId)
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        var grantActions = grantAuditLogs.Select(log => log.ActionType).OrderBy(action => action).ToArray();
        Assert.Equal(
            ["AdministratorAttendanceGroupGranted", "AdministratorAttendanceGroupRevoked"],
            grantActions);

        var revoked = grantAuditLogs.Single(log => log.ActionType == "AdministratorAttendanceGroupRevoked");
        Assert.Equal($"{seeded.AdministratorId}:{seeded.ActiveGrantedGroupId}", revoked.EntityId);
        Assert.NotNull(revoked.OldValueJson);
        using var revokedState = JsonDocument.Parse(revoked.OldValueJson!);
        Assert.Equal(
            seeded.ActiveGrantedGroupId,
            revokedState.RootElement.GetProperty("groupId").GetGuid());
        Assert.Null(revoked.NewValueJson);

        var granted = grantAuditLogs.Single(log => log.ActionType == "AdministratorAttendanceGroupGranted");
        Assert.Equal($"{seeded.AdministratorId}:{seeded.ActiveAlternateGroupId}", granted.EntityId);
        Assert.NotNull(granted.NewValueJson);
        Assert.Null(granted.OldValueJson);
    }

    [Fact]
    public async Task Task080_staff_update_role_or_branch_changes_with_stored_grants_are_blocked()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var roleResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}",
            new
            {
                FullName = "Админ",
                Login = seeded.AdministratorLogin,
                Role = "SuperAdministrator",
                MustChangePassword = false,
                IsActive = true,
                MessengerPlatform = (string?)null,
                MessengerPlatformUserId = (string?)null,
                BranchId = (Guid?)null
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, roleResponse.StatusCode);
        await AssertProblemDetailsAsync(roleResponse, "/problems/attendance-grants-must-be-revoked", "attendance_grants_must_be_revoked");

        using var branchResponse = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}",
            new
            {
                FullName = "Админ",
                Login = seeded.AdministratorLogin,
                Role = "Administrator",
                MustChangePassword = false,
                IsActive = true,
                MessengerPlatform = (string?)null,
                MessengerPlatformUserId = (string?)null,
                BranchId = seeded.SecondBranchId
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, branchResponse.StatusCode);
        await AssertProblemDetailsAsync(branchResponse, "/problems/attendance-grants-must-be-revoked", "attendance_grants_must_be_revoked");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

        var administrator = await dbContext.Users.SingleAsync(user => user.Id == seeded.AdministratorId);
        Assert.Equal(UserRole.Administrator, administrator.Role);
        Assert.Equal(seeded.AssignedBranchId, administrator.BranchId);
        Assert.True(await dbContext.AdministratorAttendanceGroupGrants.AnyAsync(grant => grant.AdministratorId == seeded.AdministratorId));
    }

    [Fact]
    public async Task Task080_administrator_grants_remain_revocable_when_target_administrator_is_inactive()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var administrator = await dbContext.Users.SingleAsync(user => user.Id == seeded.AdministratorId);
            administrator.IsActive = false;
            await dbContext.SaveChangesAsync();
        }

        using var response = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                GroupIds = Array.Empty<Guid>()
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await verificationDb.AdministratorAttendanceGroupGrants.AnyAsync(grant => grant.AdministratorId == seeded.AdministratorId));
    }

    [Fact]
    public async Task Task080_administrator_grants_remain_revocable_when_target_branch_is_archived()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var branch = await dbContext.Branches.SingleAsync(branch => branch.Id == seeded.AssignedBranchId);
            branch.IsArchived = true;
            await dbContext.SaveChangesAsync();
        }

        using var response = await PutJsonAsync(
            client,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                GroupIds = Array.Empty<Guid>()
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await verificationDb.AdministratorAttendanceGroupGrants.AnyAsync(grant => grant.AdministratorId == seeded.AdministratorId));
    }

    [Fact]
    public async Task Task080_administrator_attendance_scope_changes_immediately_after_grant_revocation()
    {
        await using var factory = new AdministratorAttendanceGrantAppFactory();
        var seeded = await SeedDataAsync(factory);

        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var administratorClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        _ = await LoginAsync(administratorClient, seeded.AdministratorLogin, seeded.SharedPassword);

        var todayString = GetBusinessToday().ToString("yyyy-MM-dd");
        var lessonClientsPath = LessonClientsPath(seeded.ActiveGrantedLessonOccurrenceId, todayString);
        var lessonSavePath = LessonSavePath(seeded.ActiveGrantedLessonOccurrenceId, todayString);

        using (var preScope = await administratorClient.GetAsync("/auth/session"))
        {
            var sessionPayload = await ReadJsonElementAsync(preScope);
            var scope = sessionPayload.GetProperty("user").GetProperty("attendanceScope");
            Assert.Equal("AdministratorGrants", scope.GetProperty("kind").GetString());
            Assert.Contains(seeded.ActiveGrantedGroupId, GetGroupIds(scope.GetProperty("groupIds")));
        }

        using var preList = await administratorClient.GetAsync("/attendance/groups");
        Assert.Equal(HttpStatusCode.OK, preList.StatusCode);
        var preListPayload = await ReadJsonElementAsync(preList);
        Assert.NotEmpty(preListPayload.GetProperty("groups").EnumerateArray());

        using var preRoster = await administratorClient.GetAsync(lessonClientsPath);
        Assert.Equal(HttpStatusCode.OK, preRoster.StatusCode);

        using (var preAccessProbe = await PostWithoutBodyAsync(
                   administratorClient,
                   $"/access/attendance/{seeded.ActiveGrantedGroupId}",
                   (await GetSessionAsync(administratorClient)).CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, preAccessProbe.StatusCode);
            var accessPayload = await ReadJsonElementAsync(preAccessProbe);
            Assert.Equal("Attendance", accessPayload.GetProperty("capability").GetString());
            Assert.Equal("administrator-attendance-grant", accessPayload.GetProperty("grantedBy").GetString());
        }

        using var revokeResponse = await PutJsonAsync(
            managerClient,
            $"/settings/administrators/{seeded.AdministratorId}/attendance-groups",
            new
            {
                ExpectedGroupIds = new[] { seeded.ActiveGrantedGroupId, seeded.ForeignBranchStoredGroupId },
                GroupIds = new[] { seeded.ForeignBranchStoredGroupId }
            },
            managerSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, revokeResponse.StatusCode);

        using (var postScope = await administratorClient.GetAsync("/auth/session"))
        {
            var scopePayload = await ReadJsonElementAsync(postScope);
            var scope = scopePayload.GetProperty("user").GetProperty("attendanceScope");
            Assert.Equal("AdministratorGrants", scope.GetProperty("kind").GetString());
            Assert.Empty(scope.GetProperty("groupIds").EnumerateArray());
        }

        using var postList = await administratorClient.GetAsync("/attendance/groups");
        var postListPayload = await ReadJsonElementAsync(postList);
        Assert.Empty(postListPayload.GetProperty("groups").EnumerateArray());

        using var forbiddenRosterResponse = await administratorClient.GetAsync(lessonClientsPath);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenRosterResponse.StatusCode);
        await AssertProblemDetailsAsync(
            forbiddenRosterResponse,
            "/problems/lesson-occurrence-not-found",
            "lesson-occurrence-not-found");

        var adminSession = await GetSessionAsync(administratorClient);
        using (var forbiddenAccessProbe = await PostWithoutBodyAsync(
                   administratorClient,
                   $"/access/attendance/{seeded.ActiveGrantedGroupId}",
                   adminSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenAccessProbe.StatusCode);
            await AssertProblemDetailsAsync(
                forbiddenAccessProbe,
                "/problems/attendance-group-forbidden",
                "attendance_group_forbidden");
        }

        using var forbiddenSaveResponse = await PostJsonAsync(
            administratorClient,
            lessonSavePath,
            new
            {
                TrainingDate = todayString,
                AttendanceMarks = new[]
                {
                    new { ClientId = Guid.NewGuid(), State = "Present" }
                }
            },
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenSaveResponse.StatusCode);
        await AssertProblemDetailsAsync(
            forbiddenSaveResponse,
            "/problems/lesson-occurrence-not-found",
            "lesson-occurrence-not-found");
    }

    private static async Task<SeededAdministratorAttendanceGrantData> SeedDataAsync(AdministratorAttendanceGrantAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "task080-password";

        var headCoach = CreateUser("headcoach-task080", "Главный тренер Task080", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var superAdministrator = CreateUser("superadministrator-task080", "Суперадминистратор Task080", UserRole.SuperAdministrator, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-task080", "Администратор Task080", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-task080", "Тренер Task080", UserRole.Coach, sharedPassword, now, passwordHashService);

        var assignedBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Task080 Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var secondBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Task080 Branch II",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = assignedBranch.Id;

        var assignedHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            Name = "Task080 Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var secondHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = secondBranch.Id,
            Name = "Task080 Hall II",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Task080 Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var activeGrantedGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            HallId = assignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Task080 Active Granted",
            TrainingStartTime = new TimeOnly(8, 0),
            DurationMinutes = 60,
            Weekdays = [1, 3],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var activeAlternateGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            HallId = assignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Task080 Active Alternate",
            TrainingStartTime = new TimeOnly(9, 0),
            DurationMinutes = 45,
            Weekdays = [2, 4],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var inactiveBranchGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = assignedBranch.Id,
            HallId = assignedHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Task080 Inactive Branch Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 45,
            Weekdays = [2, 4],
            IsActive = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignStoredGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = secondBranch.Id,
            HallId = secondHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Task080 Foreign Stored",
            TrainingStartTime = new TimeOnly(11, 0),
            DurationMinutes = 30,
            Weekdays = [3, 5],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var foreignCandidateGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = secondBranch.Id,
            HallId = secondHall.Id,
            GroupTypeId = groupType.Id,
            Name = "Task080 Foreign Candidate",
            TrainingStartTime = new TimeOnly(12, 0),
            DurationMinutes = 30,
            Weekdays = [4, 6],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var activeGrantedLessonOccurrence = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = activeGrantedGroup.Id,
            LessonDate = GetBusinessToday(),
            StartTime = activeGrantedGroup.TrainingStartTime,
            DurationMinutes = activeGrantedGroup.DurationMinutes,
            HallId = activeGrantedGroup.HallId,
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = LessonOccurrenceSourceKind.LegacyAttendance,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, superAdministrator, administrator, coach);
        dbContext.Branches.AddRange(assignedBranch, secondBranch);
        dbContext.Halls.AddRange(assignedHall, secondHall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(activeGrantedGroup, activeAlternateGroup, inactiveBranchGroup, foreignStoredGroup, foreignCandidateGroup);
        dbContext.LessonOccurrences.Add(activeGrantedLessonOccurrence);

        dbContext.AdministratorAttendanceGroupGrants.AddRange(
            new AdministratorAttendanceGroupGrant
            {
                AdministratorId = administrator.Id,
                GroupId = activeGrantedGroup.Id,
                BranchId = assignedBranch.Id,
                GrantedByUserId = headCoach.Id,
                GrantedAt = now
            },
            new AdministratorAttendanceGroupGrant
            {
                AdministratorId = administrator.Id,
                GroupId = foreignStoredGroup.Id,
                BranchId = secondBranch.Id,
                GrantedByUserId = headCoach.Id,
                GrantedAt = now
            });

        await dbContext.SaveChangesAsync();

        return new SeededAdministratorAttendanceGrantData(
            headCoach.Id,
            superAdministrator.Id,
            administrator.Id,
            coach.Id,
            headCoach.Login,
            superAdministrator.Login,
            administrator.Login,
            coach.Login,
            sharedPassword,
            assignedBranch.Id,
            secondBranch.Id,
            activeGrantedGroup.Id,
            activeGrantedLessonOccurrence.Id,
            inactiveBranchGroup.Id,
            activeAlternateGroup.Id,
            foreignStoredGroup.Id,
            foreignCandidateGroup.Id);
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        var initialSession = await GetSessionAsync(client);

        using var loginResponse = await PostJsonAsync(client, "/auth/login", new LoginRequest(login, password), initialSession.CsrfToken);
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

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static string LessonClientsPath(Guid lessonOccurrenceId, string lessonDate) =>
        $"/attendance/lessons/{lessonOccurrenceId}/clients?lessonDate={lessonDate}";

    private static string LessonSavePath(Guid lessonOccurrenceId, string lessonDate) =>
        $"/attendance/lessons/{lessonOccurrenceId}?lessonDate={lessonDate}";

    private static async Task<HttpResponseMessage> PutJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<JsonElement> ReadValidationErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        Assert.True(payload.TryGetProperty("errors", out var errors));
        return errors;
    }

    private static async Task AssertProblemDetailsAsync(HttpResponseMessage response, string expectedType, string expectedCode)
    {
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal(expectedType, payload.GetProperty("type").GetString());
        Assert.Equal(expectedCode, payload.GetProperty("code").GetString());
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
            Login = login,
            FullName = fullName,
            Role = role,
            IsActive = true,
            MustChangePassword = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);
        return user;
    }

    private static Guid[] GetGroupIds(JsonElement jsonArray)
    {
        return jsonArray.EnumerateArray()
            .Select(groupId => Guid.Parse(groupId.GetString()!))
            .ToArray();
    }

    private static Guid GetGuidFromProperty(JsonElement payload, string propertyName)
    {
        return payload.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? Guid.Parse(property.GetString()!)
            : Guid.Empty;
    }

    private static DateOnly GetBusinessToday()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(
        Guid Id,
        string FullName,
        string Login,
        string Role,
        Guid? BranchId,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen,
        string[] AllowedSections,
        UserPermissionPayload Permissions,
        object AttendanceScope,
        string[] AssignedGroupIds,
        string[] CreateRoleOptions);

    private sealed record UserPermissionPayload(
        bool CanManageUsers,
        bool CanManageClients,
        bool CanManageGroups,
        bool CanManageSettings,
        bool CanMarkAttendance,
        bool CanViewAuditLog,
        bool CanViewFinancialReports);

    private sealed record SeededAdministratorAttendanceGrantData(
        Guid HeadCoachId,
        Guid SuperAdministratorId,
        Guid AdministratorId,
        Guid CoachId,
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid AssignedBranchId,
        Guid SecondBranchId,
        Guid ActiveGrantedGroupId,
        Guid ActiveGrantedLessonOccurrenceId,
        Guid InactiveBranchGroupId,
        Guid ActiveAlternateGroupId,
        Guid ForeignBranchStoredGroupId,
        Guid ForeignBranchCandidateGroupId);

    private sealed class AdministratorAttendanceGrantAppFactory : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-task080",
                    ["BootstrapUser:FullName"] = "Bootstrap Task 080"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();

                var databaseName = $"gym-crm-administrator-attendance-grant-tests-{Guid.NewGuid():N}";
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
}
