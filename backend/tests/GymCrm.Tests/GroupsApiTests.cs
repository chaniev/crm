using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
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

public class GroupsApiTests
{
    [Fact]
    public async Task Groups_list_returns_strict_envelope_with_trimmed_search_filters_count_before_paging_and_stable_order()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        Guid assignedLocatorGroupId;
        Guid unassignedLocatorGroupId;
        Guid inactiveLocatorGroupId;
        Guid unrelatedGroupId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var inactiveAssignedTrainer = CreateUser(
                "inactive-assigned-trainer-task086",
                "Inactive Assigned Trainer TASK-086",
                UserRole.Coach,
                seeded.SharedPassword,
                seeded.Now,
                passwordHashService);
            inactiveAssignedTrainer.IsActive = false;

            var groups = new[]
            {
                new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = seeded.BranchId,
                    HallId = seeded.HallOneId,
                    GroupTypeId = seeded.GroupTypeId,
                    Name = "  Alpha Locator Active  ",
                    TrainingStartTime = new TimeOnly(11, 0),
                    DurationMinutes = 60,
                    Weekdays = [1],
                    IsActive = true,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                },
                new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = seeded.BranchId,
                    HallId = seeded.HallOneId,
                    GroupTypeId = seeded.GroupTypeId,
                    Name = "alpha locator no trainer",
                    TrainingStartTime = new TimeOnly(10, 0),
                    DurationMinutes = 60,
                    Weekdays = [2],
                    IsActive = true,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                },
                new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = seeded.BranchId,
                    HallId = seeded.HallOneId,
                    GroupTypeId = seeded.GroupTypeId,
                    Name = "Alpha Locator Inactive",
                    TrainingStartTime = new TimeOnly(12, 0),
                    DurationMinutes = 60,
                    Weekdays = [3],
                    IsActive = false,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                },
                new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = seeded.BranchId,
                    HallId = seeded.HallTwoId,
                    GroupTypeId = seeded.GroupTypeId,
                    Name = "Beta unrelated",
                    TrainingStartTime = new TimeOnly(13, 0),
                    DurationMinutes = 60,
                    Weekdays = [4],
                    IsActive = true,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                }
            };

            assignedLocatorGroupId = groups[0].Id;
            unassignedLocatorGroupId = groups[1].Id;
            inactiveLocatorGroupId = groups[2].Id;
            unrelatedGroupId = groups[3].Id;

            dbContext.Users.Add(inactiveAssignedTrainer);
            dbContext.TrainingGroups.AddRange(groups);
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = assignedLocatorGroupId,
                TrainerId = inactiveAssignedTrainer.Id
            });
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = assignedLocatorGroupId,
                TrainerId = inactiveAssignedTrainer.Id,
                ValidFrom = DateOnly.FromDateTime(seeded.Now.UtcDateTime),
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now
            });
            dbContext.GroupTrainerSubstitutions.Add(new GroupTrainerSubstitution
            {
                Id = Guid.NewGuid(),
                GroupId = unassignedLocatorGroupId,
                SubstituteTrainerId = seeded.CoachOneId,
                StartsOn = DateOnly.FromDateTime(seeded.Now.UtcDateTime).AddDays(1),
                EndsOn = DateOnly.FromDateTime(seeded.Now.UtcDateTime).AddDays(2),
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now,
                UpdatedAt = seeded.Now
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/groups?query=%20LoCaToR%20&isActive=true&withoutTrainer=true&page=1&pageSize=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.True(payload.ValueKind == JsonValueKind.Object);
        Assert.Equal(0, payload.GetProperty("skip").GetInt32());
        Assert.Equal(1, payload.GetProperty("take").GetInt32());
        Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
        var items = payload.GetProperty("items");
        Assert.Single(items.EnumerateArray());
        Assert.Equal("alpha locator no trainer", GetStringFromProperty(items[0], "name"));
        Assert.False(payload.TryGetProperty("data", out _));
        Assert.False(payload.TryGetProperty("groups", out _));

        using (var unfilteredResponse = await client.GetAsync("/groups?page=1&pageSize=100"))
        {
            Assert.Equal(HttpStatusCode.OK, unfilteredResponse.StatusCode);
            var unfilteredPayload = await ReadJsonElementAsync(unfilteredResponse);
            Assert.Equal(6, unfilteredPayload.GetProperty("totalCount").GetInt32());
            Assert.Equal(
                new[]
                {
                    assignedLocatorGroupId,
                    inactiveLocatorGroupId,
                    unassignedLocatorGroupId,
                    unrelatedGroupId,
                    seeded.GroupOneId,
                    seeded.GroupTwoId
                },
                unfilteredPayload.GetProperty("items")
                    .EnumerateArray()
                    .Select(item => GetGuidFromProperty(item, "id"))
                    .ToArray());
        }

        using (var blankQueryResponse = await client.GetAsync("/groups?query=%20%20&page=1&pageSize=100"))
        {
            Assert.Equal(HttpStatusCode.OK, blankQueryResponse.StatusCode);
            var blankQueryPayload = await ReadJsonElementAsync(blankQueryResponse);
            Assert.Equal(6, blankQueryPayload.GetProperty("totalCount").GetInt32());
        }

        using (var longQueryResponse = await client.GetAsync($"/groups?query={new string('x', 512)}"))
        {
            Assert.Equal(HttpStatusCode.OK, longQueryResponse.StatusCode);
            var longQueryPayload = await ReadJsonElementAsync(longQueryResponse);
            Assert.Equal(0, longQueryPayload.GetProperty("totalCount").GetInt32());
            Assert.Empty(longQueryPayload.GetProperty("items").EnumerateArray());
        }

        using (var inactiveLocatorResponse = await client.GetAsync("/groups?query=locator&isActive=false&page=1&pageSize=10"))
        {
            Assert.Equal(HttpStatusCode.OK, inactiveLocatorResponse.StatusCode);
            var inactiveLocatorPayload = await ReadJsonElementAsync(inactiveLocatorResponse);
            Assert.Equal(1, inactiveLocatorPayload.GetProperty("totalCount").GetInt32());
            var inactiveLocatorItem = Assert.Single(inactiveLocatorPayload.GetProperty("items").EnumerateArray());
            Assert.Equal(inactiveLocatorGroupId, GetGuidFromProperty(inactiveLocatorItem, "id"));
        }

        using (var activeAbsentResponse = await client.GetAsync("/groups?query=locator&withoutTrainer=true&page=1&pageSize=10"))
        {
            Assert.Equal(HttpStatusCode.OK, activeAbsentResponse.StatusCode);
            var activeAbsentPayload = await ReadJsonElementAsync(activeAbsentResponse);
            Assert.Equal(2, activeAbsentPayload.GetProperty("totalCount").GetInt32());
            Assert.Equal(
                new[] { inactiveLocatorGroupId, unassignedLocatorGroupId },
                activeAbsentPayload.GetProperty("items")
                    .EnumerateArray()
                    .Select(item => GetGuidFromProperty(item, "id"))
                    .ToArray());
        }
    }

    [Fact]
    public async Task Groups_list_rejects_mixed_paging_families_and_invalid_arithmetic()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var mixedResponse = await client.GetAsync("/groups?page=1&pageSize=10&skip=0"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, mixedResponse.StatusCode);
            var payload = await ReadJsonElementAsync(mixedResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("paging", out _));
        }

        using (var overflowResponse = await client.GetAsync($"/groups?page={int.MaxValue}&pageSize=100"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, overflowResponse.StatusCode);
            var payload = await ReadJsonElementAsync(overflowResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("page", out _));
        }

        using (var pageOnlyOverflowResponse = await client.GetAsync($"/groups?page={int.MaxValue}"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, pageOnlyOverflowResponse.StatusCode);
            var payload = await ReadJsonElementAsync(pageOnlyOverflowResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("page", out _));
        }

        using (var partialPageResponse = await client.GetAsync("/groups?page=2"))
        {
            Assert.Equal(HttpStatusCode.OK, partialPageResponse.StatusCode);
            var payload = await ReadJsonElementAsync(partialPageResponse);
            Assert.Equal(20, payload.GetProperty("skip").GetInt32());
            Assert.Equal(20, payload.GetProperty("take").GetInt32());
        }

        using (var partialPageSizeResponse = await client.GetAsync("/groups?pageSize=1"))
        {
            Assert.Equal(HttpStatusCode.OK, partialPageSizeResponse.StatusCode);
            var payload = await ReadJsonElementAsync(partialPageSizeResponse);
            Assert.Equal(0, payload.GetProperty("skip").GetInt32());
            Assert.Equal(1, payload.GetProperty("take").GetInt32());
        }

        using (var partialSkipResponse = await client.GetAsync("/groups?skip=1"))
        {
            Assert.Equal(HttpStatusCode.OK, partialSkipResponse.StatusCode);
            var payload = await ReadJsonElementAsync(partialSkipResponse);
            Assert.Equal(1, payload.GetProperty("skip").GetInt32());
            Assert.Equal(20, payload.GetProperty("take").GetInt32());
        }
    }

    [Fact]
    public async Task Administrator_group_management_is_scoped_to_own_branch_and_global_managers_keep_full_dataset()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        var foreign = await CreateForeignGroupAsync(factory, seeded, withTrainer: true);

        using var administratorClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var administratorSession = await LoginAsync(administratorClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using (var listResponse = await administratorClient.GetAsync("/groups?page=1&pageSize=100"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var payload = await ReadJsonElementAsync(listResponse);
            Assert.Equal(2, payload.GetProperty("totalCount").GetInt32());
            var ids = payload.GetProperty("items")
                .EnumerateArray()
                .Select(item => GetGuidFromProperty(item, "id"))
                .ToArray();
            Assert.Contains(seeded.GroupOneId, ids);
            Assert.Contains(seeded.GroupTwoId, ids);
            Assert.DoesNotContain(foreign.GroupId, ids);
        }

        using (var summaryResponse = await administratorClient.GetAsync("/groups/summary"))
        {
            Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
            var payload = await ReadJsonElementAsync(summaryResponse);
            Assert.Equal(2, payload.GetProperty("totalCount").GetInt32());
            Assert.Equal(1, payload.GetProperty("activeWithoutTrainerCount").GetInt32());
        }

        using (var foreignDetailsResponse = await administratorClient.GetAsync($"/groups/{foreign.GroupId}"))
        {
            await AssertBranchScopeForbiddenAsync(foreignDetailsResponse);
        }

        using (var foreignClientsResponse = await administratorClient.GetAsync($"/groups/{foreign.GroupId}/clients"))
        {
            await AssertBranchScopeForbiddenAsync(foreignClientsResponse);
        }

        using (var missingDetailsResponse = await administratorClient.GetAsync($"/groups/{Guid.NewGuid()}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, missingDetailsResponse.StatusCode);
        }

        using (var foreignCreateResponse = await PostJsonAsync(
                   administratorClient,
                   "/groups/preview",
                   CreateCanonicalGroupCreateRequest(
                       "Administrator foreign create forbidden",
                       foreign.BranchId,
                       foreign.HallId,
                       seeded.GroupTypeId,
                       startTime: "15:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   administratorSession.CsrfToken))
        {
            await AssertBranchScopeForbiddenAsync(foreignCreateResponse);
        }

        using (var foreignUpdateResponse = await PutJsonAsync(
                   administratorClient,
                   $"/groups/{foreign.GroupId}",
                   new
                   {
                       Name = "Administrator foreign update forbidden",
                       BranchId = foreign.BranchId,
                       HallId = foreign.HallId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "16:00:00",
                       DurationMinutes = 60,
                       Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
                   administratorSession.CsrfToken))
        {
            await AssertBranchScopeForbiddenAsync(foreignUpdateResponse);
        }

        using (var foreignTrainerResponse = await AssignTrainersToGroupAsync(
                   administratorClient,
                   $"/groups/{foreign.GroupId}",
                   foreign.GroupId,
                   new[] { seeded.CoachOneId },
                   administratorSession.CsrfToken))
        {
            await AssertBranchScopeForbiddenAsync(foreignTrainerResponse);
        }

        using (var foreignSubstitutionResponse = await PostJsonAsync(
                   administratorClient,
                   $"/groups/{foreign.GroupId}/trainer-substitutions",
                   new
                   {
                       substituteTrainerId = seeded.CoachOneId,
                       startsOn = "2026-07-26",
                       endsOn = "2026-07-28"
                   },
                   administratorSession.CsrfToken))
        {
            AssertLegacyMutationRouteAbsent(foreignSubstitutionResponse);
        }

        using var headCoachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(headCoachClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        using var headCoachListResponse = await headCoachClient.GetAsync("/groups?page=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, headCoachListResponse.StatusCode);
        var headCoachPayload = await ReadJsonElementAsync(headCoachListResponse);
        Assert.Equal(3, headCoachPayload.GetProperty("totalCount").GetInt32());
        Assert.Contains(
            headCoachPayload.GetProperty("items").EnumerateArray(),
            item => GetGuidFromProperty(item, "id") == foreign.GroupId);

        using var superAdministratorClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(superAdministratorClient, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        using var superListResponse = await superAdministratorClient.GetAsync("/groups?page=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, superListResponse.StatusCode);
        var superPayload = await ReadJsonElementAsync(superListResponse);
        Assert.Equal(3, superPayload.GetProperty("totalCount").GetInt32());
        Assert.Contains(
            superPayload.GetProperty("items").EnumerateArray(),
            item => GetGuidFromProperty(item, "id") == foreign.GroupId);
    }

    [Fact]
    public async Task Schedule_groups_remain_global_ordered_and_enveloped_after_management_scope_filters()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        var foreign = await CreateForeignGroupAsync(factory, seeded);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        Assert.Equal("Administrator", session.User?.Role);

        using var response = await client.GetAsync("/schedule/groups?skip=0&take=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var items = payload.GetProperty("items");
        Assert.Equal(3, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, payload.GetProperty("skip").GetInt32());
        Assert.Equal(10, payload.GetProperty("take").GetInt32());
        Assert.Equal(
            new[] { seeded.GroupOneId, foreign.GroupId, seeded.GroupTwoId },
            items.EnumerateArray().Select(item => GetGuidFromProperty(item, "id")).ToArray());
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task Group_summary_has_exact_contract_and_is_available_to_manage_groups_roles(string actorRole)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole == "HeadCoach"
            ? seeded.HeadCoachLogin
            : seeded.AdministratorLogin;
        _ = await LoginAsync(client, actorLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/groups/summary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            "{\"totalCount\":2,\"activeWithoutTrainerCount\":1}",
            await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Group_summary_counts_full_dataset_independently_of_list_paging()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var additionalGroups = Enumerable.Range(0, 55)
                .Select(index => new TrainingGroup
                {
                    Id = Guid.NewGuid(),
                    BranchId = seeded.BranchId,
                    HallId = seeded.HallOneId,
                    GroupTypeId = seeded.GroupTypeId,
                    Name = $"Summary paging group {index:D2}",
                    TrainingStartTime = new TimeOnly(12, 0),
                    DurationMinutes = 60,
                    Weekdays = [1],
                    IsActive = true,
                    CreatedAt = seeded.Now.AddMinutes(index + 1),
                    UpdatedAt = seeded.Now.AddMinutes(index + 1)
                })
                .ToArray();
            dbContext.TrainingGroups.AddRange(additionalGroups);
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var listResponse = await client.GetAsync("/groups?skip=0&take=50");
        using var summaryResponse = await client.GetAsync("/groups/summary");

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(50, (await ReadJsonElementAsync(listResponse)).GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
        var summary = await ReadJsonElementAsync(summaryResponse);
        Assert.Equal(57, summary.GetProperty("totalCount").GetInt32());
        Assert.Equal(56, summary.GetProperty("activeWithoutTrainerCount").GetInt32());
    }

    [Fact]
    public async Task Group_summary_counts_only_active_groups_without_trainers_and_returns_zero_for_empty_dataset()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var inactiveWithoutTrainer = await dbContext.TrainingGroups.SingleAsync(group => group.Id == seeded.GroupTwoId);
            inactiveWithoutTrainer.IsActive = false;
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var semanticResponse = await client.GetAsync("/groups/summary"))
        {
            Assert.Equal(HttpStatusCode.OK, semanticResponse.StatusCode);
            var summary = await ReadJsonElementAsync(semanticResponse);
            Assert.Equal(2, summary.GetProperty("totalCount").GetInt32());
            Assert.Equal(0, summary.GetProperty("activeWithoutTrainerCount").GetInt32());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.ClientGroups.RemoveRange(dbContext.ClientGroups);
            dbContext.GroupTrainers.RemoveRange(dbContext.GroupTrainers);
            dbContext.TrainingGroups.RemoveRange(dbContext.TrainingGroups);
            await dbContext.SaveChangesAsync();
        }

        using var emptyResponse = await client.GetAsync("/groups/summary");
        Assert.Equal(HttpStatusCode.OK, emptyResponse.StatusCode);
        Assert.Equal(
            "{\"totalCount\":0,\"activeWithoutTrainerCount\":0}",
            await emptyResponse.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    [InlineData("SuperAdministrator")]
    public async Task Manager_roles_can_manage_group_and_assign_trainers(string actorRole)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole switch
        {
            "HeadCoach" => seeded.HeadCoachLogin,
            "SuperAdministrator" => seeded.SuperAdministratorLogin,
            _ => seeded.AdministratorLogin
        };

        var actorSession = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        Assert.Equal(actorRole, actorSession.User?.Role);

        var groupName = $"Group {Guid.NewGuid():N}";
        var createRequest = CreateCanonicalGroupCreateRequest(
            groupName,
            seeded.BranchId,
            seeded.HallOneId,
            seeded.GroupTypeId,
            startTime: "18:00",
            durationMinutes: 75,
            isoWeekday: 5);
        using var createResponse = await CreateGroupViaPreviewAsync(
            client,
            createRequest,
            actorSession.CsrfToken);
        Assert.True(
            createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"Expected group create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        var groupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);
        Assert.Equal(75, GetIntFromProperty(createPayload, "durationMinutes"));
        Assert.Equal([5], GetIntArrayFromProperty(createPayload, "weekdays"));

        using (var listResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var groupsPayload = GetArrayPayload(listPayload, "data", "items", "groups");
            var createdListItem = groupsPayload.EnumerateArray()
                .Single(item => GetGuidFromProperty(item, "id") == groupId);
            Assert.Equal(75, GetIntFromProperty(createdListItem, "durationMinutes"));
            Assert.Equal([5], GetIntArrayFromProperty(createdListItem, "weekdays"));
        }

        using (var getResponse = await client.GetAsync($"/groups/{groupId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var getPayload = await ReadJsonElementAsync(getResponse);
            Assert.Equal(groupId, GetGuidFromProperty(getPayload, "id"));
            Assert.Equal(groupName, GetStringFromProperty(getPayload, "name"));
            Assert.Equal(seeded.GroupTypeId, GetGuidFromProperty(getPayload, "groupTypeId"));
            Assert.Equal("Groups Default Type", GetStringFromProperty(getPayload, "groupTypeName"));
            Assert.False(getPayload.TryGetProperty("groupType" + "System" + "Identifier", out _));
            Assert.Equal(75, GetIntFromProperty(getPayload, "durationMinutes"));
            Assert.Equal([5], GetIntArrayFromProperty(getPayload, "weekdays"));
        }

        var updatePayload = new
        {
            Name = "Group Updated",
            BranchId = seeded.BranchId,
            HallId = seeded.HallOneId,
            GroupTypeId = seeded.GroupTypeId,
            TrainingStartTime = "19:00:00",
            DurationMinutes = 90,
            Weekdays = new[] { 4, 2 },
            IsActive = true
        };
        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{groupId}",
                   updatePayload,
                   actorSession.CsrfToken))
        {
            Assert.True(
                updateResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent,
                $"Expected group update success, got {updateResponse.StatusCode}.");
            if (updateResponse.StatusCode == HttpStatusCode.OK)
            {
                var updateResponsePayload = await ReadJsonElementAsync(updateResponse);
                Assert.Equal(75, GetIntFromProperty(updateResponsePayload, "durationMinutes"));
                Assert.Equal([5], GetIntArrayFromProperty(updateResponsePayload, "weekdays"));
            }
        }

        var assignedTrainerIds = new[] { seeded.CoachOneId, seeded.HeadCoachId, seeded.CoachTwoId };
        using (var assignResponse = await AssignTrainersToGroupAsync(
                   client,
                   $"/groups/{groupId}",
                   groupId,
                   assignedTrainerIds,
                   actorSession.CsrfToken))
        {
            Assert.True(
                assignResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent or HttpStatusCode.Created,
                $"Expected trainer assignment success, got {assignResponse.StatusCode}.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var assignedGroup = await dbContext.GroupTrainers
                .Where(gt => gt.GroupId == groupId)
                .Select(gt => gt.TrainerId)
                .OrderBy(id => id)
                .ToListAsync();
            var activeTrainerAssignments = await dbContext.GroupTrainerAssignments
                .Where(assignment => assignment.GroupId == groupId && assignment.ValidTo == null)
                .Select(assignment => assignment.TrainerId)
                .OrderBy(id => id)
                .ToListAsync();

            Assert.Equal(
                assignedTrainerIds.OrderBy(id => id).ToArray(),
                assignedGroup);
            Assert.Equal(
                assignedTrainerIds.OrderBy(id => id).ToArray(),
                activeTrainerAssignments);
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{groupId}/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clientsArray = GetArrayPayload(clientsPayload, "data", "items", "clients");
            Assert.Equal(0, clientsArray.GetArrayLength());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var clientEntity = await CreateClientEntityAsync(dbContext, seeded.BranchId, seeded.Now);
            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientEntity.Id,
                GroupId = groupId,
                BranchId = seeded.BranchId
            });
            await dbContext.SaveChangesAsync();
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{groupId}/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, clientsResponse.StatusCode);
            var clientsPayload = await ReadJsonElementAsync(clientsResponse);
            var clientsArray = GetArrayPayload(clientsPayload, "data", "items", "clients");
            Assert.Equal(1, clientsArray.GetArrayLength());
        }
    }

    [Fact]
    public async Task Group_preview_and_create_commit_group_initial_series_trainers_token_and_audit_together()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var request = new
        {
            name = "Initial Series Group",
            branchId = seeded.BranchId,
            hallId = seeded.HallTwoId,
            groupTypeId = seeded.GroupTypeId,
            trainingStartTime = "07:00",
            durationMinutes = 30,
            weekdays = new[] { 3 },
            isActive = true,
            trainerIds = new[] { seeded.CoachOneId, seeded.CoachTwoId },
            initialLessonSeries = new
            {
                startsOn = "2026-09-01",
                endsOn = (string?)null,
                slots = new[]
                {
                    new
                    {
                        isoWeekday = 1,
                        startTime = "10:00",
                        durationMinutes = 60,
                        hallId = seeded.HallOneId
                    },
                    new
                    {
                        isoWeekday = 1,
                        startTime = "18:00",
                        durationMinutes = 75,
                        hallId = seeded.HallTwoId
                    }
                }
            }
        };

        using var previewResponse = await PostJsonAsync(
            client,
            "/groups/preview",
            request,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));
        Assert.Empty(preview.GetProperty("warnings").EnumerateArray());

        using var createResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                request.name,
                request.branchId,
                request.hallId,
                request.groupTypeId,
                request.trainingStartTime,
                request.durationMinutes,
                request.weekdays,
                request.isActive,
                request.trainerIds,
                request.initialLessonSeries,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await ReadJsonElementAsync(createResponse);
        var groupId = GetGuidFromProperty(created, "id");
        Assert.Equal(seeded.HallOneId, GetGuidFromProperty(created, "hallId"));
        Assert.Equal("10:00", GetStringFromProperty(created, "trainingStartTime"));
        Assert.Equal(new[] { 1 }, created.GetProperty("weekdays").EnumerateArray().Select(day => day.GetInt32()).ToArray());

        using var replayResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                request.name,
                request.branchId,
                request.hallId,
                request.groupTypeId,
                request.trainingStartTime,
                request.durationMinutes,
                request.weekdays,
                request.isActive,
                request.trainerIds,
                request.initialLessonSeries,
                confirmationToken
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        var replayProblem = await ReadJsonElementAsync(replayResponse);
        Assert.Equal("lesson-mutation-preview-invalid", replayProblem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedGroup = await dbContext.TrainingGroups
            .AsNoTracking()
            .SingleAsync(group => group.Id == groupId);
        Assert.Equal(seeded.HallOneId, persistedGroup.HallId);
        Assert.Equal(new TimeOnly(10, 0), persistedGroup.TrainingStartTime);
        Assert.Equal(60, persistedGroup.DurationMinutes);
        Assert.Equal(new[] { 1 }, persistedGroup.Weekdays);

        var series = await dbContext.LessonSeries
            .AsNoTracking()
            .SingleAsync(candidate => candidate.GroupId == groupId);
        Assert.Equal(new DateOnly(2026, 9, 1), series.StartsOn);
        Assert.Null(series.EndsOn);

        var rule = await dbContext.LessonScheduleRuleVersions
            .AsNoTracking()
            .SingleAsync(candidate => candidate.LessonSeriesId == series.Id);
        Assert.Equal(1, rule.VersionNumber);
        Assert.Equal(new DateOnly(2026, 9, 1), rule.EffectiveFrom);
        Assert.Null(rule.EffectiveTo);

        var slots = await dbContext.LessonScheduleSlots
            .AsNoTracking()
            .Where(slot => slot.LessonScheduleRuleVersionId == rule.Id)
            .OrderBy(slot => slot.StartTime)
            .ToArrayAsync();
        Assert.Equal(2, slots.Length);
        Assert.Equal(new[] { new TimeOnly(10, 0), new TimeOnly(18, 0) }, slots.Select(slot => slot.StartTime).ToArray());
        Assert.All(slots, slot => Assert.NotEqual(Guid.Empty, slot.SlotLineageId));
        Assert.Equal(2, slots.Select(slot => slot.SlotLineageId).Distinct().Count());

        Assert.Equal(
            new[] { seeded.CoachOneId, seeded.CoachTwoId }.OrderBy(trainerId => trainerId).ToArray(),
            await dbContext.GroupTrainers
                .AsNoTracking()
                .Where(trainer => trainer.GroupId == groupId)
                .OrderBy(trainer => trainer.TrainerId)
                .Select(trainer => trainer.TrainerId)
                .ToArrayAsync());
        Assert.All(
            await dbContext.GroupTrainerAssignments
                .AsNoTracking()
                .Where(assignment => assignment.GroupId == groupId)
                .ToArrayAsync(),
            assignment => Assert.Equal(new DateOnly(2026, 9, 1), assignment.ValidFrom));
        Assert.Equal(1, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == "TrainingGroupCreated" &&
            log.EntityType == "TrainingGroup" &&
            log.EntityId == groupId.ToString()));
    }

    [Fact]
    public async Task Group_create_with_initial_series_requires_preview_token_and_leaves_no_partial_group()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                name = "Missing Token Initial Series Group",
                branchId = seeded.BranchId,
                hallId = seeded.HallOneId,
                groupTypeId = seeded.GroupTypeId,
                trainingStartTime = "10:00",
                durationMinutes = 60,
                weekdays = new[] { 1 },
                isActive = true,
                trainerIds = new[] { seeded.CoachOneId },
                initialLessonSeries = new
                {
                    startsOn = "2026-09-01",
                    endsOn = (string?)null,
                    slots = new[]
                    {
                        new
                        {
                            isoWeekday = 1,
                            startTime = "10:00",
                            durationMinutes = 60,
                            hallId = seeded.HallOneId
                        }
                    }
                }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.Equal("lesson-mutation-preview-invalid", problem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await dbContext.TrainingGroups.AnyAsync(group => group.Name == "Missing Token Initial Series Group"));
        Assert.Equal(0, await dbContext.LessonSeries.CountAsync());
        Assert.Equal(0, await dbContext.LessonScheduleRuleVersions.CountAsync());
        Assert.Equal(0, await dbContext.LessonScheduleSlots.CountAsync());
    }

    [Fact]
    public async Task Group_create_with_changed_payload_after_preview_is_stale_and_leaves_no_partial_group()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var initialLessonSeries = new
        {
            startsOn = "2026-09-01",
            endsOn = (string?)null,
            slots = new[]
            {
                new
                {
                    isoWeekday = 1,
                    startTime = "10:00",
                    durationMinutes = 60,
                    hallId = seeded.HallOneId
                }
            }
        };
        var previewRequest = new
        {
            name = "Preview Name",
            branchId = seeded.BranchId,
            hallId = seeded.HallOneId,
            groupTypeId = seeded.GroupTypeId,
            trainingStartTime = "10:00",
            durationMinutes = 60,
            weekdays = new[] { 1 },
            isActive = true,
            trainerIds = new[] { seeded.CoachOneId },
            initialLessonSeries
        };

        using var previewResponse = await PostJsonAsync(
            client,
            "/groups/preview",
            previewRequest,
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var confirmationToken = (await ReadJsonElementAsync(previewResponse)).GetProperty("confirmationToken").GetString();

        using var executeResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                name = "Changed Name",
                previewRequest.branchId,
                previewRequest.hallId,
                previewRequest.groupTypeId,
                previewRequest.trainingStartTime,
                previewRequest.durationMinutes,
                previewRequest.weekdays,
                previewRequest.isActive,
                previewRequest.trainerIds,
                previewRequest.initialLessonSeries,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, executeResponse.StatusCode);
        var problem = await ReadJsonElementAsync(executeResponse);
        Assert.Equal("lesson-mutation-preview-stale", problem.GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.False(await dbContext.TrainingGroups.AnyAsync(group => group.Name == "Preview Name" || group.Name == "Changed Name"));
        Assert.Equal(0, await dbContext.LessonSeries.CountAsync());
        Assert.Equal(0, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
    }

    [Fact]
    public async Task Group_preview_rejects_overlapping_initial_slots_without_issuing_token()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/groups/preview",
            new
            {
                name = "Overlapping Initial Series Group",
                branchId = seeded.BranchId,
                hallId = seeded.HallOneId,
                groupTypeId = seeded.GroupTypeId,
                trainingStartTime = "10:00",
                durationMinutes = 60,
                weekdays = new[] { 1 },
                isActive = true,
                trainerIds = new[] { seeded.CoachOneId },
                initialLessonSeries = new
                {
                    startsOn = "2026-09-01",
                    endsOn = (string?)null,
                    slots = new[]
                    {
                        new
                        {
                            isoWeekday = 1,
                            startTime = "10:00",
                            durationMinutes = 60,
                            hallId = seeded.HallOneId
                        },
                        new
                        {
                            isoWeekday = 1,
                            startTime = "10:30",
                            durationMinutes = 60,
                            hallId = seeded.HallTwoId
                        }
                    }
                }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.True(problem.GetProperty("errors").TryGetProperty("initialLessonSeries.slots", out _));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.ScheduleMutationConfirmationTokens.CountAsync());
        Assert.False(await dbContext.TrainingGroups.AnyAsync(group => group.Name == "Overlapping Initial Series Group"));
    }

    [Fact]
    public async Task Trainer_assignments_preview_execute_replaces_future_periods_preserves_history_consumes_token_and_audits()
    {
        await using var factory = new GroupsAppFactory(useSqlite: true);
        var seeded = await SeedGroupsDataAsync(factory);
        await AddLessonSeriesAsync(factory, seeded.GroupOneId, seeded.HallOneId, new DateOnly(2035, 1, 1));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var request = new
        {
            assignments = new[]
            {
                new
                {
                    trainerId = seeded.CoachOneId,
                    validFrom = "2035-01-01",
                    validTo = (string?)null
                }
            }
        };

        using var previewResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments/preview",
            request,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        var revision = preview.GetProperty("revision").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));
        Assert.False(string.IsNullOrWhiteSpace(revision));
        Assert.True(preview.GetProperty("impact").GetProperty("totalAffectedOccurrences").GetInt32() > 0);
        Assert.Empty(preview.GetProperty("warnings").EnumerateArray());

        using var executeResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments",
            new
            {
                request.assignments,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        var executed = await ReadJsonElementAsync(executeResponse);
        Assert.NotEqual(revision, executed.GetProperty("revision").GetString());
        Assert.Contains(
            executed.GetProperty("assignments").EnumerateArray(),
            assignment =>
                GetGuidFromProperty(assignment, "trainerId") == seeded.CoachOneId &&
                assignment.GetProperty("validFrom").GetString() == "2035-01-01");

        using var replayResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments",
            new
            {
                request.assignments,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        Assert.Equal("lesson-mutation-preview-invalid", (await ReadJsonElementAsync(replayResponse)).GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var preservedHistoricalAssignment = await dbContext.GroupTrainerAssignments
            .AsNoTracking()
            .SingleAsync(assignment => assignment.GroupId == seeded.GroupOneId && assignment.TrainerId == seeded.CoachTwoId);
        Assert.Equal(new DateOnly(2034, 12, 31), preservedHistoricalAssignment.ValidTo);
        Assert.True(await dbContext.GroupTrainerAssignments.AnyAsync(assignment =>
            assignment.GroupId == seeded.GroupOneId &&
            assignment.TrainerId == seeded.CoachOneId &&
            assignment.ValidFrom == new DateOnly(2035, 1, 1) &&
            assignment.ValidTo == null));
        Assert.True(await dbContext.GroupTrainers.AnyAsync(trainer =>
            trainer.GroupId == seeded.GroupOneId &&
            trainer.TrainerId == seeded.CoachTwoId));
        Assert.Equal(1, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == "TrainingGroupUpdated" &&
            log.EntityType == "TrainingGroup" &&
            log.EntityId == seeded.GroupOneId.ToString()));
    }

    [Fact]
    public async Task Trainer_assignments_execute_rejects_stale_revision_after_concurrent_assignment_change()
    {
        await using var factory = new GroupsAppFactory(useSqlite: true);
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var request = new
        {
            assignments = new[]
            {
                new
                {
                    trainerId = seeded.CoachOneId,
                    validFrom = "2035-01-01",
                    validTo = (string?)null
                }
            }
        };

        using var previewResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments/preview",
            request,
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var revision = preview.GetProperty("revision").GetString();
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = seeded.GroupOneId,
                TrainerId = seeded.CoachOneId,
                ValidFrom = new DateOnly(2034, 12, 1),
                ValidTo = new DateOnly(2034, 12, 31),
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now
            });
            await dbContext.SaveChangesAsync();
        }

        using var executeResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments",
            new
            {
                request.assignments,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, executeResponse.StatusCode);
        Assert.Equal("lesson-mutation-preview-stale", (await ReadJsonElementAsync(executeResponse)).GetProperty("code").GetString());

        using var verifyScope = factory.Services.CreateScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await verifyDbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.False(await verifyDbContext.GroupTrainerAssignments.AnyAsync(assignment =>
            assignment.GroupId == seeded.GroupOneId &&
            assignment.TrainerId == seeded.CoachOneId &&
            assignment.ValidFrom == new DateOnly(2035, 1, 1)));
    }

    [Fact]
    public async Task Trainer_assignments_preview_reports_overlap_warning_for_other_group_assignment()
    {
        await using var factory = new GroupsAppFactory(useSqlite: true);
        var seeded = await SeedGroupsDataAsync(factory);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = seeded.GroupTwoId,
                TrainerId = seeded.CoachOneId,
                ValidFrom = new DateOnly(2035, 1, 1),
                ValidTo = null,
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainer-assignments/preview",
            new
            {
                assignments = new[]
                {
                    new
                    {
                        trainerId = seeded.CoachOneId,
                        validFrom = "2035-01-01",
                        validTo = (string?)null
                    }
                }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var warnings = (await ReadJsonElementAsync(response)).GetProperty("warnings").EnumerateArray().ToArray();
        var warning = Assert.Single(warnings);
        Assert.Equal("group_trainer_assignment_overlap", warning.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Trainer_assignments_preview_respects_branch_scope()
    {
        await using var factory = new GroupsAppFactory(useSqlite: true);
        var seeded = await SeedGroupsDataAsync(factory);
        var foreign = await CreateForeignGroupAsync(factory, seeded);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            $"/groups/{foreign.GroupId}/trainer-assignments/preview",
            new
            {
                assignments = new[]
                {
                    new
                    {
                        trainerId = seeded.CoachOneId,
                        validFrom = "2035-01-01",
                        validTo = (string?)null
                    }
                }
            },
            session.CsrfToken);

        await AssertBranchScopeForbiddenAsync(response);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.ScheduleMutationConfirmationTokens.CountAsync());
    }

    [Fact]
    public async Task Lesson_series_preview_execute_splits_this_and_future_rule_consumes_token_and_audits()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        await AddLessonSeriesAsync(factory, seeded.GroupOneId, seeded.HallOneId, new DateOnly(2035, 1, 1));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
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
                    hallId = seeded.HallOneId
                }
            }
        };

        using var previewResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series/preview",
            request,
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        var revision = preview.GetProperty("revision").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));
        Assert.False(string.IsNullOrWhiteSpace(revision));
        Assert.Equal("ThisAndFuture", preview.GetProperty("scope").GetString());
        Assert.True(preview.GetProperty("impact").GetProperty("totalAffectedOccurrences").GetInt32() > 0);

        using var executeResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series",
            new
            {
                request.scope,
                request.effectiveFrom,
                request.endsOn,
                request.slots,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, executeResponse.StatusCode);
        var executed = await ReadJsonElementAsync(executeResponse);
        Assert.NotEqual(revision, executed.GetProperty("revision").GetString());

        using var replayResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series",
            new
            {
                request.scope,
                request.effectiveFrom,
                request.endsOn,
                request.slots,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.Conflict, replayResponse.StatusCode);
        Assert.Equal("lesson-mutation-preview-invalid", (await ReadJsonElementAsync(replayResponse)).GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var series = await dbContext.LessonSeries.SingleAsync(candidate => candidate.GroupId == seeded.GroupOneId);
        var versions = await dbContext.LessonScheduleRuleVersions
            .Include(version => version.Slots)
            .Where(version => version.LessonSeriesId == series.Id)
            .OrderBy(version => version.EffectiveFrom)
            .ToArrayAsync();
        Assert.Equal(2, versions.Length);
        Assert.Equal(new DateOnly(2035, 1, 7), versions[0].EffectiveTo);
        Assert.Equal(new DateOnly(2035, 1, 8), versions[1].EffectiveFrom);
        var replacementSlot = Assert.Single(versions[1].Slots);
        Assert.Equal(new TimeOnly(12, 0), replacementSlot.StartTime);
        Assert.Equal(75, replacementSlot.DurationMinutes);
        Assert.Equal(1, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token => token.ConsumedAt != null));
        Assert.Equal(1, await dbContext.AuditLogs.CountAsync(log =>
            log.ActionType == "LessonSeriesUpdated" &&
            log.EntityType == "LessonSeries" &&
            log.EntityId == series.Id.ToString()));
    }

    [Fact]
    public async Task Lesson_series_execute_rejects_stale_revision_after_concurrent_series_change()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        await AddLessonSeriesAsync(factory, seeded.GroupOneId, seeded.HallOneId, new DateOnly(2035, 1, 1));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
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
                    hallId = seeded.HallOneId
                }
            }
        };

        using var previewResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series/preview",
            request,
            session.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var preview = await ReadJsonElementAsync(previewResponse);
        var revision = preview.GetProperty("revision").GetString();
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var series = await dbContext.LessonSeries.SingleAsync(candidate => candidate.GroupId == seeded.GroupOneId);
            series.EndsOn = new DateOnly(2035, 12, 31);
            await dbContext.SaveChangesAsync();
        }

        using var executeResponse = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series",
            new
            {
                request.scope,
                request.effectiveFrom,
                request.endsOn,
                request.slots,
                expectedRevision = revision,
                confirmationToken
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.Conflict, executeResponse.StatusCode);
        Assert.Equal("lesson-mutation-preview-stale", (await ReadJsonElementAsync(executeResponse)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Lesson_series_preview_rejects_overlapping_same_day_slots_without_token()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        await AddLessonSeriesAsync(factory, seeded.GroupOneId, seeded.HallOneId, new DateOnly(2035, 1, 1));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var weekday = ToIsoWeekday(new DateOnly(2035, 1, 8));

        using var response = await PostJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/lesson-series/preview",
            new
            {
                scope = "ThisAndFuture",
                effectiveFrom = "2035-01-08",
                endsOn = (string?)null,
                slots = new[]
                {
                    new
                    {
                        isoWeekday = weekday,
                        startTime = "12:00",
                        durationMinutes = 75,
                        hallId = seeded.HallOneId
                    },
                    new
                    {
                        isoWeekday = weekday,
                        startTime = "12:30",
                        durationMinutes = 60,
                        hallId = seeded.HallTwoId
                    }
                }
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadJsonElementAsync(response);
        Assert.True(problem.GetProperty("errors").TryGetProperty("slots", out _));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(0, await dbContext.ScheduleMutationConfirmationTokens.CountAsync(token =>
            token.Purpose == "group-lesson-series"));
    }

    [Fact]
    public async Task Legacy_schedule_and_group_trainer_routes_are_absent_after_cutover()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var cancelResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{Guid.NewGuid()}/cancel?lessonDate=2035-01-01",
            new { revision = "unused" },
            session.CsrfToken);
        using var restoreResponse = await PostJsonAsync(
            client,
            $"/schedule/lessons/{Guid.NewGuid()}/restore?lessonDate=2035-01-01",
            new { revision = "unused" },
            session.CsrfToken);
        using var trainerResponse = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}/trainers",
            new { trainerIds = Array.Empty<Guid>() },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.NotFound, cancelResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, restoreResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, trainerResponse.StatusCode);
    }

    [Fact]
    public async Task SuperAdministrator_can_create_groups_in_two_branches()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        Guid foreignBranchId;
        Guid foreignHallId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var foreignBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Groups Foreign Branch",
                IsArchived = false,
                CreatedAt = seeded.Now,
                UpdatedAt = seeded.Now
            };
            var foreignHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = foreignBranch.Id,
                Name = "Groups Foreign Hall",
                IsArchived = false,
                CreatedAt = seeded.Now,
                UpdatedAt = seeded.Now
            };
            dbContext.Branches.Add(foreignBranch);
            dbContext.Halls.Add(foreignHall);
            await dbContext.SaveChangesAsync();
            foreignBranchId = foreignBranch.Id;
            foreignHallId = foreignHall.Id;
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.SuperAdministratorLogin, seeded.SharedPassword);
        var createdGroups = new List<(Guid Id, Guid BranchId)>();

        foreach (var (branchId, hallId, suffix) in new[]
                 {
                     (seeded.BranchId, seeded.HallOneId, "own"),
                     (foreignBranchId, foreignHallId, "foreign")
                 })
        {
            using var response = await CreateGroupViaPreviewAsync(
                client,
                CreateCanonicalGroupCreateRequest(
                    $"SA two-branch {suffix}",
                    branchId,
                    hallId,
                    seeded.GroupTypeId,
                    startTime: "17:00",
                    durationMinutes: 60,
                    isoWeekday: 2),
                session.CsrfToken);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            createdGroups.Add((GetGuidFromProperty(payload, "id"), branchId));
            Assert.Equal(branchId, GetGuidFromProperty(payload, "branchId"));
        }

        using var listResponse = await client.GetAsync("/groups?page=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var listPayload = await ReadJsonElementAsync(listResponse);
        var groups = GetArrayPayload(listPayload, "data", "items", "groups");
        foreach (var createdGroup in createdGroups)
        {
            var item = groups.EnumerateArray()
                .Single(group => GetGuidFromProperty(group, "id") == createdGroup.Id);
            Assert.Equal(createdGroup.BranchId, GetGuidFromProperty(item, "branchId"));
        }
    }

    [Fact]
    public async Task Trainer_options_include_active_coaches_and_headcoach_only()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);

        Guid inactiveCoachId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var inactiveCoach = CreateUser(
                "inactive-coach-stage5",
                "Неактивный тренер Stage 5",
                UserRole.Coach,
                seeded.SharedPassword,
                seeded.Now,
                passwordHashService);
            inactiveCoach.IsActive = false;
            inactiveCoachId = inactiveCoach.Id;
            dbContext.Users.Add(inactiveCoach);
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        _ = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await client.GetAsync("/groups/options/trainers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        var options = GetArrayPayload(payload, "data", "items", "trainers");
        var optionIds = options
            .EnumerateArray()
            .Select(option => GetGuidFromProperty(option, "id"))
            .ToArray();

        Assert.Contains(seeded.HeadCoachId, optionIds);
        Assert.Contains(seeded.CoachOneId, optionIds);
        Assert.Contains(seeded.CoachTwoId, optionIds);
        Assert.DoesNotContain(seeded.AdministratorId, optionIds);
        Assert.DoesNotContain(inactiveCoachId, optionIds);
    }

    [Fact]
    public async Task Group_trainer_assignment_rejects_administrator_and_inactive_users()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);

        Guid inactiveHeadCoachId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
            var inactiveHeadCoach = CreateUser(
                "inactive-headcoach-stage5",
                "Неактивный главный тренер Stage 5",
                UserRole.HeadCoach,
                seeded.SharedPassword,
                seeded.Now,
                passwordHashService);
            inactiveHeadCoach.IsActive = false;
            inactiveHeadCoachId = inactiveHeadCoach.Id;
            dbContext.Users.Add(inactiveHeadCoach);
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var administratorResponse = await AssignTrainersToGroupAsync(
                   client,
                   $"/groups/{seeded.GroupOneId}",
                   seeded.GroupOneId,
                   new[] { seeded.AdministratorId },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, administratorResponse.StatusCode);
            var payload = await ReadJsonElementAsync(administratorResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("trainerIds", out _));
        }

        using (var inactiveResponse = await AssignTrainersToGroupAsync(
                   client,
                   $"/groups/{seeded.GroupOneId}",
                   seeded.GroupOneId,
                   new[] { inactiveHeadCoachId },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, inactiveResponse.StatusCode);
            var payload = await ReadJsonElementAsync(inactiveResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("trainerIds", out _));
        }
    }

    [Fact]
    public async Task Group_update_rejects_branch_change()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        Guid foreignBranchId;
        Guid foreignHallId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var foreignBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Immutable Foreign Branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = foreignBranch.Id,
                Name = "Immutable Foreign Hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Branches.Add(foreignBranch);
            dbContext.Halls.Add(foreignHall);
            await dbContext.SaveChangesAsync();
            foreignBranchId = foreignBranch.Id;
            foreignHallId = foreignHall.Id;
        }

        using var response = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}",
            new
            {
                Name = "Branch Change Rejected",
                BranchId = foreignBranchId,
                HallId = foreignHallId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "11:00:00",
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
    }

    [Fact]
    public async Task Group_deactivation_with_active_or_future_target_memberships_returns_conflict()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        Guid blockingMembershipId;
        Guid blockingSaleId;
        Guid blockingClientId;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var client = await CreateClientEntityAsync(dbContext, seeded.BranchId, seeded.Now);
            var today = GetBusinessToday();
            var sale = AddTargetedMembership(
                dbContext,
                client.Id,
                seeded.GroupOneId,
                seeded.BranchId,
                MembershipBehaviorKind.Professional,
                today.AddDays(1),
                today.AddDays(30),
                singleVisitUsed: false,
                technicalClosed: false,
                seeded.HeadCoachId,
                seeded.Now);
            await dbContext.SaveChangesAsync();
            blockingMembershipId = sale.MembershipId;
            blockingSaleId = sale.SaleId;
            blockingClientId = client.Id;
        }

        using var clientHttp = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(clientHttp, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PutJsonAsync(
            clientHttp,
            $"/groups/{seeded.GroupOneId}",
            new
            {
                Name = "Existing coach-visible group",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "09:00:00",
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = false
            },
            session.CsrfToken);
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("group-active-memberships", payload.GetProperty("type").GetString());
        Assert.Equal("group-active-memberships", payload.GetProperty("code").GetString());
        Assert.Contains("перенесите", payload.GetProperty("recovery").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.True(payload.GetProperty("errors").TryGetProperty("isActive", out _));

        var affectedMembership = Assert.Single(payload.GetProperty("affectedMemberships").EnumerateArray());
        Assert.Equal(blockingMembershipId.ToString(), affectedMembership.GetProperty("membershipId").GetString());
        Assert.Equal(blockingSaleId.ToString(), affectedMembership.GetProperty("saleId").GetString());
        Assert.Equal(blockingClientId.ToString(), affectedMembership.GetProperty("clientId").GetString());
        Assert.Equal("Professional", affectedMembership.GetProperty("membershipType").GetString());
        Assert.Equal("Future", affectedMembership.GetProperty("entitlementState").GetString());
    }

    [Fact]
    public async Task Group_deactivation_ignores_expired_used_and_closed_target_memberships()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var today = GetBusinessToday();
            var client = await CreateClientEntityAsync(dbContext, seeded.BranchId, seeded.Now);
            AddTargetedMembership(
                dbContext,
                client.Id,
                seeded.GroupOneId,
                seeded.BranchId,
                MembershipBehaviorKind.Term,
                today.AddDays(-30),
                today.AddDays(-1),
                singleVisitUsed: false,
                technicalClosed: false,
                seeded.HeadCoachId,
                seeded.Now);

            AddTargetedMembership(
                dbContext,
                client.Id,
                seeded.GroupOneId,
                seeded.BranchId,
                MembershipBehaviorKind.SingleVisit,
                today,
                null,
                singleVisitUsed: true,
                technicalClosed: false,
                seeded.HeadCoachId,
                seeded.Now);

            AddTargetedMembership(
                dbContext,
                client.Id,
                seeded.GroupOneId,
                seeded.BranchId,
                MembershipBehaviorKind.Term,
                today.AddDays(-1),
                today.AddDays(30),
                singleVisitUsed: false,
                technicalClosed: true,
                seeded.HeadCoachId,
                seeded.Now);

            await dbContext.SaveChangesAsync();
        }

        using var clientHttp = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(clientHttp, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PutJsonAsync(
            clientHttp,
            $"/groups/{seeded.GroupOneId}",
            new
            {
                Name = "Existing coach-visible group",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "09:00:00",
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = false
            },
            session.CsrfToken);
        var payload = await ReadJsonElementAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(payload.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Coach_cannot_access_groups_management_endpoints()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);

        Assert.Equal("Coach", actorSession.User?.Role);

        using (var listResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        }

        using (var summaryResponse = await client.GetAsync("/groups/summary"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, summaryResponse.StatusCode);
        }

        using (var getResponse = await client.GetAsync($"/groups/{seeded.GroupOneId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/groups",
                   new
                   {
                       Name = "Coach attempt",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallOneId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "18:00:00",
                       DurationMinutes = 60,
                       Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{seeded.GroupOneId}",
                   new
                   {
                       Name = "Forbidden update",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallOneId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "18:30:00",
                       DurationMinutes = 60,
                       Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }

        using (var clientsResponse = await client.GetAsync($"/groups/{seeded.GroupOneId}/clients"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, clientsResponse.StatusCode);
        }
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    [InlineData("Coach")]
    public async Task Authenticated_crm_user_can_access_schedule_groups_with_role_specific_scope(string actorRole)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole switch
        {
            "HeadCoach" => seeded.HeadCoachLogin,
            "Administrator" => seeded.AdministratorLogin,
            "Coach" => seeded.CoachLogin,
            _ => throw new InvalidOperationException($"Unsupported actor role '{actorRole}'.")
        };

        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        Assert.Equal(actorRole, session.User?.Role);

        using var response = await client.GetAsync("/schedule/groups");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        var expectedCount = actorRole == "Coach" ? 0 : 2;
        Assert.Equal(expectedCount, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, payload.GetProperty("skip").GetInt32());
        Assert.Equal(20, payload.GetProperty("take").GetInt32());
        Assert.Equal(expectedCount, GetArrayPayload(payload, "items").GetArrayLength());
    }

    [Fact]
    public async Task Anonymous_user_is_unauthorized_for_schedule_groups()
    {
        await using var factory = new GroupsAppFactory();
        await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        using var response = await client.GetAsync("/schedule/groups");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Coach_without_effective_groups_gets_empty_schedule_without_group_management_access()
    {
        await using var factory = new GroupsAppFactory(businessDate: new DateOnly(2026, 7, 25));
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", session.User?.Role);

        using (var response = await client.GetAsync("/schedule/groups?skip=0&take=10"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var payload = await ReadJsonElementAsync(response);
            var items = GetArrayPayload(payload, "items");

            Assert.Equal(0, payload.GetProperty("totalCount").GetInt32());
            Assert.Equal(0, payload.GetProperty("skip").GetInt32());
            Assert.Equal(10, payload.GetProperty("take").GetInt32());
            Assert.Empty(items.EnumerateArray());
        }

        using var managementResponse = await client.GetAsync("/groups");
        Assert.Equal(HttpStatusCode.Forbidden, managementResponse.StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Coach_schedule_groups_are_limited_to_effective_assignments_before_count_and_paging(bool useSqlite)
    {
        var businessDate = new DateOnly(2026, 7, 25);
        await using var factory = new GroupsAppFactory(useSqlite: useSqlite, businessDate: businessDate);
        var seeded = await SeedGroupsDataAsync(factory);
        var unrelated = await CreateForeignGroupAsync(factory, seeded);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = seeded.GroupTwoId,
                TrainerId = seeded.CoachOneId
            });
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = seeded.GroupTwoId,
                TrainerId = seeded.CoachOneId,
                ValidFrom = businessDate,
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now
            });
            dbContext.GroupTrainerSubstitutions.AddRange(
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = seeded.GroupOneId,
                    SubstituteTrainerId = seeded.CoachOneId,
                    StartsOn = businessDate,
                    EndsOn = businessDate,
                    CreatedByUserId = seeded.HeadCoachId,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                },
                new GroupTrainerSubstitution
                {
                    Id = Guid.NewGuid(),
                    GroupId = unrelated.GroupId,
                    SubstituteTrainerId = seeded.CoachOneId,
                    StartsOn = businessDate.AddDays(1),
                    EndsOn = businessDate.AddDays(2),
                    CreatedByUserId = seeded.HeadCoachId,
                    CreatedAt = seeded.Now,
                    UpdatedAt = seeded.Now
                });
            await dbContext.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var session = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", session.User?.Role);

        using var response = await client.GetAsync("/schedule/groups?page=1&pageSize=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var items = GetArrayPayload(payload, "items");

        Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, payload.GetProperty("skip").GetInt32());
        Assert.Equal(1, payload.GetProperty("take").GetInt32());
        var item = Assert.Single(items.EnumerateArray());
        Assert.Equal(seeded.GroupTwoId, GetGuidFromProperty(item, "id"));
        Assert.DoesNotContain(
            items.EnumerateArray(),
            candidate => GetGuidFromProperty(candidate, "id") == unrelated.GroupId);
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    [InlineData("SuperAdministrator")]
    public async Task Non_coach_schedule_group_sets_remain_global_and_exact(string actorRole)
    {
        await using var factory = new GroupsAppFactory(businessDate: new DateOnly(2026, 7, 25));
        var seeded = await SeedGroupsDataAsync(factory);
        var foreign = await CreateForeignGroupAsync(factory, seeded);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole switch
        {
            "HeadCoach" => seeded.HeadCoachLogin,
            "Administrator" => seeded.AdministratorLogin,
            "SuperAdministrator" => seeded.SuperAdministratorLogin,
            _ => throw new InvalidOperationException($"Unsupported actor role '{actorRole}'.")
        };
        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        Assert.Equal(actorRole, session.User?.Role);

        using var response = await client.GetAsync("/schedule/groups?skip=0&take=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal(3, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(
            new[] { seeded.GroupOneId, foreign.GroupId, seeded.GroupTwoId },
            GetArrayPayload(payload, "items")
                .EnumerateArray()
                .Select(item => GetGuidFromProperty(item, "id"))
                .ToArray());
    }

    [Fact]
    public async Task Schedule_groups_support_page_and_pageSize_paging()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        Assert.Equal("HeadCoach", session.User?.Role);

        using var response = await client.GetAsync("/schedule/groups?page=2&pageSize=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await ReadJsonElementAsync(response);
        var items = GetArrayPayload(payload, "items");

        Assert.Equal(2, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, payload.GetProperty("skip").GetInt32());
        Assert.Equal(1, payload.GetProperty("take").GetInt32());
        Assert.Single(items.EnumerateArray());
        Assert.Equal(seeded.GroupTwoId, GetGuidFromProperty(items[0], "id"));
    }

    [Fact]
    public async Task Group_create_requires_branch_and_hall_from_same_branch()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var missingBranchAndHallResponse = await PostJsonAsync(
                   client,
                   "/groups/preview",
                   CreateCanonicalGroupCreateRequest(
                       "No branch hall",
                       null,
                       null,
                       seeded.GroupTypeId,
                       startTime: "18:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingBranchAndHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(missingBranchAndHallResponse);
            var errors = payload.GetProperty("errors");
            Assert.True(errors.TryGetProperty("branchId", out _));
            Assert.True(errors.TryGetProperty("hallId", out _));
        }

        Guid foreignHallId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var foreignBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Groups Foreign Branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = foreignBranch.Id,
                Name = "Groups Foreign Hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Branches.Add(foreignBranch);
            dbContext.Halls.Add(foreignHall);
            await dbContext.SaveChangesAsync();
            foreignHallId = foreignHall.Id;
        }

        using (var wrongHallResponse = await PostJsonAsync(
                   client,
                   "/groups/preview",
                   CreateCanonicalGroupCreateRequest(
                       "Wrong hall",
                       seeded.BranchId,
                       foreignHallId,
                       seeded.GroupTypeId,
                       startTime: "18:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, wrongHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(wrongHallResponse);
            var errors = payload.GetProperty("errors");
            Assert.True(
                errors.TryGetProperty("hallId", out _) ||
                errors.TryGetProperty("initialLessonSeries.slots.hallId", out _));
        }
    }

    [Fact]
    public async Task Group_create_requires_valid_group_type()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var missingGroupTypeResponse = await PostJsonAsync(
                   client,
                   "/groups/preview",
                   CreateCanonicalGroupCreateRequest(
                       "No group type",
                       seeded.BranchId,
                       seeded.HallOneId,
                       null,
                       startTime: "18:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingGroupTypeResponse.StatusCode);
            var payload = await ReadJsonElementAsync(missingGroupTypeResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupTypeId", out _));
        }

        using (var unknownGroupTypeResponse = await PostJsonAsync(
                   client,
                   "/groups/preview",
                   CreateCanonicalGroupCreateRequest(
                       "Unknown group type",
                       seeded.BranchId,
                       seeded.HallOneId,
                       Guid.NewGuid(),
                       startTime: "18:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, unknownGroupTypeResponse.StatusCode);
            var payload = await ReadJsonElementAsync(unknownGroupTypeResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupTypeId", out _));
        }
    }

    [Fact]
    public async Task Group_create_rejects_missing_duration_and_weekdays()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/groups/preview",
            CreateCanonicalGroupCreateRequest(
                "Missing schedule fields",
                seeded.BranchId,
                seeded.HallOneId,
                seeded.GroupTypeId,
                startTime: "18:00",
                durationMinutes: null,
                isoWeekday: null),
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");
        Assert.True(errors.TryGetProperty("initialLessonSeries.slots[0].durationMinutes", out _));
        Assert.True(errors.TryGetProperty("initialLessonSeries.slots[0].isoWeekday", out _));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    [InlineData(181)]
    public async Task Group_create_rejects_duration_out_of_range(int durationMinutes)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/groups/preview",
            CreateCanonicalGroupCreateRequest(
                $"Invalid duration {durationMinutes}",
                seeded.BranchId,
                seeded.HallOneId,
                seeded.GroupTypeId,
                startTime: "18:00",
                durationMinutes: durationMinutes,
                isoWeekday: 1),
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.True(payload.GetProperty("errors").TryGetProperty("initialLessonSeries.slots[0].durationMinutes", out _));
    }

    [Fact]
    public async Task Group_create_rejects_invalid_weekdays()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PostJsonAsync(
            client,
            "/groups/preview",
            CreateCanonicalGroupCreateRequest(
                "Invalid weekdays",
                seeded.BranchId,
                seeded.HallOneId,
                seeded.GroupTypeId,
                startTime: "18:00",
                durationMinutes: 60,
                isoWeekday: 8),
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");
        Assert.True(errors.TryGetProperty("initialLessonSeries.slots[0].isoWeekday", out _));
    }

    [Fact]
    public async Task Group_update_ignores_legacy_schedule_fields()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var response = await PutJsonAsync(
            client,
            $"/groups/{seeded.GroupOneId}",
            new
            {
                Name = "Invalid update",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "18:00:00",
                DurationMinutes = 181,
                Weekdays = new[] { 2, 2 },
                IsActive = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("Invalid update", GetStringFromProperty(payload, "name"));
        Assert.Equal(seeded.HallOneId, GetGuidFromProperty(payload, "hallId"));
        Assert.Equal("09:00", GetStringFromProperty(payload, "trainingStartTime"));
        Assert.Equal(60, GetIntFromProperty(payload, "durationMinutes"));
        Assert.Equal([1, 3], GetIntArrayFromProperty(payload, "weekdays"));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedGroup = await dbContext.TrainingGroups.AsNoTracking().SingleAsync(group => group.Id == seeded.GroupOneId);
        Assert.Equal(seeded.HallOneId, persistedGroup.HallId);
        Assert.Equal(new TimeOnly(9, 0), persistedGroup.TrainingStartTime);
        Assert.Equal(60, persistedGroup.DurationMinutes);
        Assert.Equal([1, 3], persistedGroup.Weekdays);
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("SuperAdministrator")]
    [InlineData("Administrator")]
    public async Task Manage_settings_roles_can_get_and_update_group_types(string actorRole)
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorLogin = actorRole switch
        {
            "HeadCoach" => seeded.HeadCoachLogin,
            "SuperAdministrator" => seeded.SuperAdministratorLogin,
            _ => seeded.AdministratorLogin
        };
        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);

        using (var initialListResponse = await client.GetAsync("/group-types"))
        {
            Assert.Equal(HttpStatusCode.OK, initialListResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(initialListResponse);
            var seededGroupType = listPayload.EnumerateArray()
                .Single(item => GetGuidFromProperty(item, "id") == seeded.GroupTypeId);
            Assert.Equal("Groups Default Type", GetStringFromProperty(seededGroupType, "name"));
            Assert.Equal(2, GetIntFromProperty(seededGroupType, "groupCount"));
            Assert.False(seededGroupType.TryGetProperty("system" + "Identifier", out _));
        }

        Guid groupTypeId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/group-types",
                   new
                   {
                       Name = "Custom Group Type",
                       Description = "Created from settings."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createResponse);
            groupTypeId = GetGuidFromProperty(payload, "id");
            Assert.NotEqual(Guid.Empty, groupTypeId);
            Assert.Equal("Custom Group Type", GetStringFromProperty(payload, "name"));
            Assert.False(payload.TryGetProperty("system" + "Identifier", out _));
        }

        using (var duplicateResponse = await PostJsonAsync(
                   client,
                   "/group-types",
                   new
                   {
                       Name = "Custom Group Type",
                       Description = "Duplicate."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(duplicateResponse);
            var errors = payload.GetProperty("errors");
            Assert.True(errors.TryGetProperty("name", out _));
            Assert.False(errors.TryGetProperty("system" + "Identifier", out _));
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/group-types/{groupTypeId}",
                   new
                   {
                       Name = "Custom Group Type Updated",
                       Description = (string?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal("Custom Group Type Updated", GetStringFromProperty(payload, "name"));
        }

        using (var getResponse = await client.GetAsync($"/group-types/{groupTypeId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var payload = await ReadJsonElementAsync(getResponse);
            Assert.Equal(groupTypeId, GetGuidFromProperty(payload, "id"));
            Assert.Equal("Custom Group Type Updated", GetStringFromProperty(payload, "name"));
            Assert.Equal(0, GetIntFromProperty(payload, "groupCount"));
            Assert.False(payload.TryGetProperty("system" + "Identifier", out _));
        }

        using (var deleteResponse = await DeleteAsync(client, $"/group-types/{groupTypeId}", session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Coach_cannot_manage_group_types()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            Assert.Equal(
                0,
                await dbContext.AuditLogs.CountAsync(log =>
                    log.EntityType == "GroupType" &&
                    log.EntityId == seeded.GroupTypeId.ToString()));
        }

        using (var listResponse = await client.GetAsync("/group-types"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/group-types",
                   new
                   {
                       Name = "Coach Type",
                       Description = ""
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/group-types/{seeded.GroupTypeId}",
                   new
                   {
                       Name = "Coach Mutated Type",
                       Description = "Coach should not be able to mutate this."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var groupType = await dbContext.GroupTypes.SingleAsync(type => type.Id == seeded.GroupTypeId);
            Assert.Equal("Groups Default Type", groupType.Name);
            Assert.Null(groupType.Description);
            Assert.Equal(
                0,
                await dbContext.AuditLogs.CountAsync(log =>
                    log.EntityType == "GroupType" &&
                    log.EntityId == seeded.GroupTypeId.ToString()));
        }
    }

    [Fact]
    public async Task Group_type_update_preserves_linked_group_identity_exposes_new_name_and_writes_stable_audit()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/group-types/{seeded.GroupTypeId}",
                   new
                   {
                       Name = "Groups Default Type Renamed",
                       Description = "Updated by Administrator."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal(seeded.GroupTypeId, GetGuidFromProperty(payload, "id"));
            Assert.Equal("Groups Default Type Renamed", GetStringFromProperty(payload, "name"));
            Assert.Equal("Updated by Administrator.", GetStringFromProperty(payload, "description"));
            Assert.Equal(2, GetIntFromProperty(payload, "groupCount"));
        }

        using (var groupDetailsResponse = await client.GetAsync($"/groups/{seeded.GroupOneId}"))
        {
            Assert.Equal(HttpStatusCode.OK, groupDetailsResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupDetailsResponse);
            Assert.Equal(seeded.GroupTypeId, GetGuidFromProperty(payload, "groupTypeId"));
            Assert.Equal("Groups Default Type Renamed", GetStringFromProperty(payload, "groupTypeName"));
        }

        using (var groupsListResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, groupsListResponse.StatusCode);
            var payload = await ReadJsonElementAsync(groupsListResponse);
            var groups = GetArrayPayload(payload, "data", "items", "groups");
            var linkedGroup = groups.EnumerateArray()
                .Single(item => GetGuidFromProperty(item, "id") == seeded.GroupOneId);
            Assert.Equal(seeded.GroupTypeId, GetGuidFromProperty(linkedGroup, "groupTypeId"));
            Assert.Equal("Groups Default Type Renamed", GetStringFromProperty(linkedGroup, "groupTypeName"));
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var linkedGroup = await dbContext.TrainingGroups.SingleAsync(group => group.Id == seeded.GroupOneId);
            Assert.Equal(seeded.GroupTypeId, linkedGroup.GroupTypeId);

            var updateAudit = await dbContext.AuditLogs.SingleAsync(log =>
                log.ActionType == "GroupTypeUpdated" &&
                log.EntityType == "GroupType" &&
                log.EntityId == seeded.GroupTypeId.ToString());
            Assert.Equal(seeded.AdministratorId, updateAudit.UserId);
            Assert.Equal(
                $"Пользователь '{seeded.AdministratorLogin}' изменил тип группы 'Groups Default Type Renamed'.",
                updateAudit.Description);
            AssertGroupTypeAuditState(
                updateAudit.OldValueJson,
                seeded.GroupTypeId,
                "Groups Default Type",
                null,
                2);
            AssertGroupTypeAuditState(
                updateAudit.NewValueJson,
                seeded.GroupTypeId,
                "Groups Default Type Renamed",
                "Updated by Administrator.",
                2);
        }
    }

    [Fact]
    public async Task Group_type_update_returns_current_validation_problem_for_invalid_or_duplicate_name()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        using (var invalidResponse = await PutJsonAsync(
                   client,
                   $"/group-types/{seeded.GroupTypeId}",
                   new
                   {
                       Name = " ",
                       Description = "Invalid update."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
            var payload = await ReadJsonElementAsync(invalidResponse);
            var errors = payload.GetProperty("errors");
            var nameErrors = GetStringArrayFromProperty(errors, "name");
            Assert.Contains("Укажите название типа группы.", nameErrors);
            Assert.False(payload.TryGetProperty("system" + "Identifier", out _));
        }

        Guid duplicateGroupTypeId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/group-types",
                   new
                   {
                       Name = "Duplicate Update Target",
                       Description = "Used for duplicate validation."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            var payload = await ReadJsonElementAsync(createResponse);
            duplicateGroupTypeId = GetGuidFromProperty(payload, "id");
        }

        using (var duplicateResponse = await PutJsonAsync(
                   client,
                   $"/group-types/{duplicateGroupTypeId}",
                   new
                   {
                       Name = "Groups Default Type",
                       Description = "Duplicate name update."
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
            var payload = await ReadJsonElementAsync(duplicateResponse);
            var errors = payload.GetProperty("errors");
            var nameErrors = GetStringArrayFromProperty(errors, "name");
            Assert.Contains("Тип группы с таким названием уже существует.", nameErrors);
            Assert.False(payload.TryGetProperty("system" + "Identifier", out _));
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var originalGroupType = await dbContext.GroupTypes.SingleAsync(type => type.Id == seeded.GroupTypeId);
            var duplicateGroupType = await dbContext.GroupTypes.SingleAsync(type => type.Id == duplicateGroupTypeId);
            Assert.Equal("Groups Default Type", originalGroupType.Name);
            Assert.Equal("Duplicate Update Target", duplicateGroupType.Name);
            Assert.Equal(
                0,
                await dbContext.AuditLogs.CountAsync(log =>
                    log.ActionType == "GroupTypeUpdated" &&
                    log.EntityType == "GroupType"));
        }
    }

    [Fact]
    public async Task Group_create_and_update_audit_entries_are_append_only_and_no_sensitive_data()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var operationStartedAt = DateTimeOffset.UtcNow;

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var initialAuditCount = await dbContext.AuditLogs.CountAsync(
                log => log.UserId == seeded.HeadCoachId &&
                    log.CreatedAt >= operationStartedAt);
            Assert.Equal(0, initialAuditCount);
        }

        var createRequest = CreateCanonicalGroupCreateRequest(
            $"Audit group {Guid.NewGuid():N}",
            seeded.BranchId,
            seeded.HallOneId,
            seeded.GroupTypeId,
            startTime: "07:00",
            durationMinutes: 60,
            isoWeekday: 1);
        using var createResponse = await CreateGroupViaPreviewAsync(
            client,
            createRequest,
            session.CsrfToken);

        Assert.True(createResponse.IsSuccessStatusCode);

        var createPayload = await ReadJsonElementAsync(createResponse);
        var createdGroupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);
        var createdGroupName = GetStringFromProperty(createPayload, "name");

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var midAudit = await dbContext.AuditLogs.Where(
                    log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();
            Assert.NotEmpty(midAudit);
            foreach (var log in midAudit)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }

            var createLog = await dbContext.AuditLogs.SingleAsync(log =>
                log.ActionType == "TrainingGroupCreated" &&
                log.EntityType == "TrainingGroup" &&
                log.EntityId == createdGroupId.ToString());

            Assert.Equal(
                $"Пользователь '{seeded.HeadCoachLogin}' создал группу '{createdGroupName}'.",
                createLog.Description);
            AssertAuditSchedule(createLog.NewValueJson, 60, [1]);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/groups/{createdGroupId}",
                   new
                   {
                       Name = "Audit group updated",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallOneId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "08:00:00",
                       DurationMinutes = 90,
                       Weekdays = new[] { 4, 2 },
                       IsActive = true
                   },
                   session.CsrfToken))
        {
            Assert.True(updateResponse.IsSuccessStatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var finalAudit = await dbContext.AuditLogs
                .Where(log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
                .OrderBy(log => log.CreatedAt)
                .ToListAsync();

            Assert.True(finalAudit.Count >= 2);

            foreach (var log in finalAudit)
            {
                AssertNoPasswordInAuditState(log.OldValueJson);
                AssertNoPasswordInAuditState(log.NewValueJson);
            }

            var updateLog = await dbContext.AuditLogs.SingleAsync(log =>
                log.ActionType == "TrainingGroupUpdated" &&
                log.EntityType == "TrainingGroup" &&
                log.EntityId == createdGroupId.ToString());

            Assert.Equal(
                $"Пользователь '{seeded.HeadCoachLogin}' изменил группу 'Audit group updated'.",
                updateLog.Description);
            AssertAuditSchedule(updateLog.OldValueJson, 60, [1]);
            AssertAuditSchedule(updateLog.NewValueJson, 60, [1]);
        }
    }

    [Fact]
    public async Task Coach_session_reflects_assigned_group_after_group_assignment()
    {
        await using var factory = new GroupsAppFactory();
        var seeded = await SeedGroupsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);

        Guid createdGroupId;
        using (var createResponse = await CreateGroupViaPreviewAsync(
                   client,
                   CreateCanonicalGroupCreateRequest(
                       "Coach Session Group",
                       seeded.BranchId,
                       seeded.HallTwoId,
                       seeded.GroupTypeId,
                       startTime: "12:00",
                       durationMinutes: 60,
                       isoWeekday: 1),
                   managerSession.CsrfToken))
        {
            Assert.True(
                createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
                $"Expected group create success, got {createResponse.StatusCode}.");
            var createPayload = await ReadJsonElementAsync(createResponse);
            createdGroupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var createdGroup = await dbContext.TrainingGroups.SingleAsync(g => g.Name == "Coach Session Group");
            await AssignCoachesToGroupDirectlyAsync(dbContext, createdGroup.Id, new[] { seeded.CoachOneId });
            await dbContext.SaveChangesAsync();
        }

        var coachSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Contains(createdGroupId.ToString(), coachSession.User?.AssignedGroupIds ?? Array.Empty<string>());

        var accessAssigned = await PostWithoutBodyAsync(
            client,
            $"/access/attendance/{createdGroupId}",
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, accessAssigned.StatusCode);

        var accessUnassigned = await PostWithoutBodyAsync(
            client,
            $"/access/attendance/{seeded.GroupOneId}",
            coachSession.CsrfToken);
        Assert.Equal(HttpStatusCode.Forbidden, accessUnassigned.StatusCode);
    }

    private static async Task<SeededGroupsData> SeedGroupsDataAsync(GroupsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage5-password";

        var headCoach = CreateUser("headcoach-stage5", "Главный тренер Stage 5", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var superAdministrator = CreateUser(
            "superadministrator-stage5",
            "Суперадминистратор Stage 5",
            UserRole.SuperAdministrator,
            sharedPassword,
            now,
            passwordHashService);
        var administrator = CreateUser("administrator-stage5", "Администратор Stage 5", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coachOne = CreateUser("coach-one-stage5", "Тренер 1 Stage 5", UserRole.Coach, sharedPassword, now, passwordHashService);
        var coachTwo = CreateUser("coach-two-stage5", "Тренер 2 Stage 5", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Groups Branch",
            Address = "Groups address",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var hallOne = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Groups Hall One",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var hallTwo = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Groups Hall Two",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        administrator.BranchId = branch.Id;

        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Groups Default Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var groupOne = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hallOne.Id,
            GroupTypeId = groupType.Id,
            Name = "Existing coach-visible group",
            TrainingStartTime = new TimeOnly(9, 0),
            DurationMinutes = 60,
            Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var groupTwo = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hallTwo.Id,
            GroupTypeId = groupType.Id,
            Name = "Later seeded schedule group",
            TrainingStartTime = new TimeOnly(18, 30),
            DurationMinutes = 90,
            Weekdays = new[] { 2, 4, 6 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var seededClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Календарев",
            FirstName = "Клиент",
            Phone = "+7999000111",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, superAdministrator, administrator, coachOne, coachTwo);
        dbContext.Branches.Add(branch);
        dbContext.Halls.AddRange(hallOne, hallTwo);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(groupOne, groupTwo);
        dbContext.Clients.Add(seededClient);
        dbContext.ClientGroups.Add(new ClientGroup
        {
            ClientId = seededClient.Id,
            GroupId = groupOne.Id,
            BranchId = branch.Id
        });
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = groupOne.Id,
            TrainerId = coachTwo.Id
        });
        dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = groupOne.Id,
            TrainerId = coachTwo.Id,
            ValidFrom = DateOnly.FromDateTime(now.UtcDateTime),
            CreatedByUserId = headCoach.Id,
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();

        return new SeededGroupsData(
            headCoach.Id,
            administrator.Id,
            coachOne.Id,
            coachTwo.Id,
            headCoach.Login,
            superAdministrator.Login,
            administrator.Login,
            coachOne.Login,
            sharedPassword,
            branch.Id,
            hallOne.Id,
            hallTwo.Id,
            groupType.Id,
            groupOne.Id,
            groupTwo.Id,
            now);
    }

    private static async Task AddLessonSeriesAsync(
        GroupsAppFactory factory,
        Guid groupId,
        Guid hallId,
        DateOnly startsOn)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var now = DateTimeOffset.UtcNow;
        var series = new LessonSeries
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            StartsOn = startsOn,
            CreatedAt = now,
            UpdatedAt = now
        };
        var rule = new LessonScheduleRuleVersion
        {
            Id = Guid.NewGuid(),
            LessonSeriesId = series.Id,
            VersionNumber = 1,
            EffectiveFrom = startsOn,
            CreatedAt = now
        };
        rule.Slots.Add(new LessonScheduleSlot
        {
            Id = Guid.NewGuid(),
            LessonScheduleRuleVersionId = rule.Id,
            SlotLineageId = Guid.NewGuid(),
            IsoWeekday = ToIsoWeekday(startsOn),
            StartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            HallId = hallId,
            CreatedAt = now
        });

        if ((dbContext.Database.ProviderName ?? string.Empty).Contains("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO "LessonSeries" ("Id", "GroupId", "StartsOn", "EndsOn", "Version", "CreatedAt", "UpdatedAt")
                VALUES ({series.Id}, {series.GroupId}, {series.StartsOn}, NULL, 1, {series.CreatedAt}, {series.UpdatedAt})
                """);
        }
        else
        {
            dbContext.LessonSeries.Add(series);
        }

        dbContext.LessonScheduleRuleVersions.Add(rule);
        await dbContext.SaveChangesAsync();
    }

    private static int ToIsoWeekday(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;
    }

    private static async Task<ForeignGroupData> CreateForeignGroupAsync(
        GroupsAppFactory factory,
        SeededGroupsData seeded,
        bool withTrainer = false)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var foreignBranch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "TASK-086 Foreign Branch",
            IsArchived = false,
            CreatedAt = seeded.Now,
            UpdatedAt = seeded.Now
        };
        var foreignHall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            Name = "TASK-086 Foreign Hall",
            IsArchived = false,
            CreatedAt = seeded.Now,
            UpdatedAt = seeded.Now
        };
        var foreignGroup = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = foreignBranch.Id,
            HallId = foreignHall.Id,
            GroupTypeId = seeded.GroupTypeId,
            Name = "Foreign schedule group",
            TrainingStartTime = new TimeOnly(12, 0),
            DurationMinutes = 60,
            Weekdays = [5],
            IsActive = true,
            CreatedAt = seeded.Now,
            UpdatedAt = seeded.Now
        };

        dbContext.Branches.Add(foreignBranch);
        dbContext.Halls.Add(foreignHall);
        dbContext.TrainingGroups.Add(foreignGroup);
        if (withTrainer)
        {
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = foreignGroup.Id,
                TrainerId = seeded.CoachTwoId
            });
            dbContext.GroupTrainerAssignments.Add(new GroupTrainerAssignment
            {
                Id = Guid.NewGuid(),
                GroupId = foreignGroup.Id,
                TrainerId = seeded.CoachTwoId,
                ValidFrom = DateOnly.FromDateTime(seeded.Now.UtcDateTime),
                CreatedByUserId = seeded.HeadCoachId,
                CreatedAt = seeded.Now
            });
        }

        await dbContext.SaveChangesAsync();
        return new ForeignGroupData(foreignBranch.Id, foreignHall.Id, foreignGroup.Id);
    }

    private static async Task<Client> CreateClientEntityAsync(GymCrmDbContext dbContext, Guid branchId, DateTimeOffset now)
    {
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branchId,
            LastName = "Фамилия",
            FirstName = "Имя",
            Phone = $"+7999000{new Random().Next(100, 999)}",
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync();
        return client;
    }

    private static SeededTargetedMembership AddTargetedMembership(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid groupId,
        Guid branchId,
        MembershipBehaviorKind behaviorKind,
        DateOnly? validFrom,
        DateOnly? validTo,
        bool singleVisitUsed,
        bool technicalClosed,
        Guid changedByUserId,
        DateTimeOffset now)
    {
        var sale = new ClientMembershipSale
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BehaviorKind = behaviorKind,
            PurchaseDate = validFrom ?? DateOnly.FromDateTime(now.UtcDateTime.Date),
            PaymentDate = validFrom ?? DateOnly.FromDateTime(now.UtcDateTime.Date),
            GrossAmount = 100m,
            CreatedByUserId = changedByUserId,
            CreatedAt = now
        };
        var membership = new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = sale.Id,
            BehaviorKind = behaviorKind,
            IndividualValidFrom = validFrom,
            IndividualValidTo = validTo,
            SingleVisitUsed = singleVisitUsed,
            ValidFrom = now,
            ValidTo = technicalClosed ? now.AddMinutes(1) : null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ChangedByUserId = changedByUserId,
            CreatedAt = now
        };

        membership.TargetGroups.Add(new ClientMembershipTargetGroup
        {
            ClientMembershipId = membership.Id,
            GroupId = groupId,
            BranchId = branchId,
            Position = 0
        });

        dbContext.ClientMembershipSales.Add(sale);
        dbContext.ClientMemberships.Add(membership);
        return new SeededTargetedMembership(sale.Id, membership.Id);
    }

    private static async Task AssignCoachesToGroupDirectlyAsync(
        GymCrmDbContext dbContext,
        Guid groupId,
        IReadOnlyList<Guid> coachIds)
    {
        foreach (var coachId in coachIds)
        {
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = groupId,
                TrainerId = coachId
            });
        }

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

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static object CreateCanonicalGroupCreateRequest(
        string name,
        Guid? branchId,
        Guid? hallId,
        Guid? groupTypeId,
        string startsOn = "2035-01-01",
        int? isoWeekday = 1,
        string startTime = "10:00",
        int? durationMinutes = 60,
        bool isActive = true,
        IReadOnlyList<Guid>? trainerIds = null)
    {
        return new
        {
            name,
            branchId,
            hallId,
            groupTypeId,
            trainingStartTime = startTime,
            durationMinutes,
            weekdays = isoWeekday.HasValue ? new[] { isoWeekday.Value } : Array.Empty<int>(),
            isActive,
            trainerIds = trainerIds ?? Array.Empty<Guid>(),
            initialLessonSeries = new
            {
                startsOn,
                endsOn = (string?)null,
                slots = new[]
                {
                    new
                    {
                        isoWeekday,
                        startTime,
                        durationMinutes,
                        hallId
                    }
                }
            }
        };
    }

    private static async Task<HttpResponseMessage> CreateGroupViaPreviewAsync(
        HttpClient client,
        object request,
        string csrfToken)
    {
        using var previewResponse = await PostJsonAsync(
            client,
            "/groups/preview",
            request,
            csrfToken);
        Assert.Equal(HttpStatusCode.OK, previewResponse.StatusCode);
        var previewPayload = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = previewPayload.GetProperty("confirmationToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));

        var executePayload = JsonSerializer.SerializeToNode(request)?.AsObject()
            ?? throw new InvalidOperationException("Group create request did not serialize to a JSON object.");
        executePayload["confirmationToken"] = confirmationToken;

        return await PostJsonAsync(
            client,
            "/groups",
            executePayload,
            csrfToken);
    }

    private static async Task<HttpResponseMessage> DeleteAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task AssertBranchScopeForbiddenAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.Equal("/problems/branch-scope-forbidden", GetStringFromProperty(payload, "type"));
        Assert.Equal("branch_scope_forbidden", GetStringFromProperty(payload, "code"));
    }

    private static void AssertLegacyMutationRouteAbsent(HttpResponseMessage response)
    {
        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected legacy mutation route absence (404/405), got {response.StatusCode}.");
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private static async Task<Guid> ExtractGroupIdFromResponseAsync(
        HttpResponseMessage response,
        JsonElement responsePayload)
    {
        if (TryGetGuid(responsePayload, "Id", out var groupId))
        {
            return groupId;
        }

        if (TryGetGuid(responsePayload, "id", out groupId))
        {
            return groupId;
        }

        if (response.Headers.Location is { } location &&
            Guid.TryParse(location.Segments.LastOrDefault(), out var idFromLocation))
        {
            return idFromLocation;
        }

        Assert.Fail("Group id not present in create response.");
        return Guid.Empty;
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

    private static bool TryGetGuid(JsonElement payload, string propertyName, out Guid value)
    {
        if (payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            Guid.TryParse(property.GetString(), out value))
        {
            return true;
        }

        value = Guid.Empty;
        return false;
    }

    private static Guid GetGuidFromProperty(JsonElement payload, string propertyName)
    {
        return TryGetGuid(payload, propertyName, out var value) ? value : Guid.Empty;
    }

    private static string GetStringFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.GetString() is { } value
            ? value
            : string.Empty;
    }

    private static int GetIntFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Number
            ? property.GetInt32()
            : 0;
    }

    private static int[] GetIntArrayFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Array
            ? property.EnumerateArray().Select(item => item.GetInt32()).ToArray()
            : [];
    }

    private static Guid[] GetGuidArrayFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Array
            ? property.EnumerateArray()
                .Select(item => Guid.TryParse(item.GetString(), out var value) ? value : Guid.Empty)
                .ToArray()
            : [];
    }

    private static string[] GetStringArrayFromProperty(JsonElement payload, string propertyName)
    {
        return payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Array
            ? property.EnumerateArray()
                .Select(item => item.GetString() ?? string.Empty)
                .ToArray()
            : [];
    }

    private static async Task<HttpResponseMessage> AssignTrainersToGroupAsync(
        HttpClient client,
        string groupEndpointBase,
        Guid groupId,
        IReadOnlyList<Guid> trainerIds,
        string csrfToken)
    {
        var today = GetBusinessToday()
            .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var trainerPayload = new
        {
            assignments = trainerIds
                .Select(trainerId => new
                {
                    trainerId,
                    validFrom = today,
                    validTo = (string?)null
                })
                .ToArray()
        };

        var previewResponse = await PostJsonAsync(
            client,
            $"{groupEndpointBase}/trainer-assignments/preview",
            trainerPayload,
            csrfToken);

        if (previewResponse.StatusCode is not HttpStatusCode.OK)
        {
            return previewResponse;
        }

        var preview = await ReadJsonElementAsync(previewResponse);
        var confirmationToken = preview.GetProperty("confirmationToken").GetString();
        var revision = preview.GetProperty("revision").GetString();
        previewResponse.Dispose();

        return await PostJsonAsync(
            client,
            $"/groups/{groupId}/trainer-assignments",
            new
            {
                trainerPayload.assignments,
                expectedRevision = revision,
                confirmationToken
            },
            csrfToken);
    }

    private static DateOnly GetBusinessToday()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);
    }

    private static bool ContainsPasswordFieldInJson(string jsonPayload)
    {
        try
        {
            using var document = JsonDocument.Parse(jsonPayload);
            return ContainsPasswordField(document.RootElement);
        }
        catch (JsonException)
        {
            return jsonPayload.Contains("password", StringComparison.OrdinalIgnoreCase);
        }
    }

    private static bool ContainsPasswordField(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name.Contains("password", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (ContainsPasswordField(property.Value))
                {
                    return true;
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (ContainsPasswordField(item))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static void AssertNoPasswordInAuditState(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return;
        }

        Assert.False(ContainsPasswordFieldInJson(payload), "Audit log payload contains password fields.");
    }

    private static void AssertAuditSchedule(
        string? payload,
        int expectedDurationMinutes,
        int[] expectedWeekdays)
    {
        Assert.False(string.IsNullOrWhiteSpace(payload), "Audit state payload is empty.");
        using var document = JsonDocument.Parse(payload!);
        Assert.Equal(expectedDurationMinutes, GetIntFromProperty(document.RootElement, "durationMinutes"));
        Assert.Equal(expectedWeekdays, GetIntArrayFromProperty(document.RootElement, "weekdays"));
    }

    private static void AssertGroupTypeAuditState(
        string? payload,
        Guid expectedId,
        string expectedName,
        string? expectedDescription,
        int expectedGroupCount)
    {
        Assert.False(string.IsNullOrWhiteSpace(payload), "Audit state payload is empty.");
        using var document = JsonDocument.Parse(payload!);
        var root = document.RootElement;
        Assert.Equal(expectedId, GetGuidFromProperty(root, "id"));
        Assert.Equal(expectedName, GetStringFromProperty(root, "name"));
        Assert.Equal(expectedGroupCount, GetIntFromProperty(root, "groupCount"));

        if (expectedDescription is null)
        {
            Assert.True(
                root.TryGetProperty("description", out var description) &&
                    description.ValueKind == JsonValueKind.Null,
                "Expected group type audit description to be null.");
        }
        else
        {
            Assert.Equal(expectedDescription, GetStringFromProperty(root, "description"));
        }
    }

    private sealed record SeededGroupsData(
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachOneId,
        Guid CoachTwoId,
        string HeadCoachLogin,
        string SuperAdministratorLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid BranchId,
        Guid HallOneId,
        Guid HallTwoId,
        Guid GroupTypeId,
        Guid GroupOneId,
        Guid GroupTwoId,
        DateTimeOffset Now);

    private sealed record ForeignGroupData(Guid BranchId, Guid HallId, Guid GroupId);

    private sealed record SeededTargetedMembership(Guid SaleId, Guid MembershipId);

    private sealed record SessionPayload(bool IsAuthenticated, string CsrfToken, UserPayload? User);

    private sealed record UserPayload(
        string Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen,
        string[] AllowedSections,
        PermissionPayload Permissions,
        string[] AssignedGroupIds);

    private sealed record PermissionPayload(
        bool CanManageUsers,
        bool CanManageClients,
        bool CanManageGroups,
        bool CanManageSettings,
        bool CanMarkAttendance,
        bool CanViewAuditLog);

    private sealed record LoginRequest(string Login, string Password);

    private sealed class GroupsAppFactory(bool useSqlite = false, DateOnly? businessDate = null) : WebApplicationFactory<Program>
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
                    ["BootstrapUser:Login"] = "bootstrap-stage5",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 5"
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
                    var databaseName = $"gym-crm-groups-tests-{Guid.NewGuid():N}";
                    var entityFrameworkProvider = new ServiceCollection()
                        .AddEntityFrameworkInMemoryDatabase()
                        .BuildServiceProvider();

                    services.AddDbContext<GymCrmDbContext>(options =>
                        options
                            .UseInMemoryDatabase(databaseName)
                            .UseInternalServiceProvider(entityFrameworkProvider));
                }

                if (businessDate.HasValue)
                {
                    services.RemoveAll<IBusinessDateProvider>();
                    services.AddSingleton<IBusinessDateProvider>(new FixedBusinessDateProvider(businessDate.Value));
                }
            });
        }
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }
}
