using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class GroupsApiTests
{
    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_group_and_assign_trainers(string actorRole)
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

        var actorSession = await LoginAsync(client, actorLogin, seeded.SharedPassword);
        Assert.Equal(actorRole, actorSession.User?.Role);

        var groupName = $"Group {Guid.NewGuid():N}";
        using var createResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                Name = groupName,
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "18:00:00",
                DurationMinutes = 75,
                Weekdays = new[] { 5, 1, 3 },
                IsActive = true
            },
            actorSession.CsrfToken);
        Assert.True(
            createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"Expected group create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        var groupId = await ExtractGroupIdFromResponseAsync(createResponse, createPayload);
        Assert.Equal(75, GetIntFromProperty(createPayload, "durationMinutes"));
        Assert.Equal([1, 3, 5], GetIntArrayFromProperty(createPayload, "weekdays"));

        using (var listResponse = await client.GetAsync("/groups"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var groupsPayload = GetArrayPayload(listPayload, "data", "items", "groups");
            var createdListItem = groupsPayload.EnumerateArray()
                .Single(item => GetGuidFromProperty(item, "id") == groupId);
            Assert.Equal(75, GetIntFromProperty(createdListItem, "durationMinutes"));
            Assert.Equal([1, 3, 5], GetIntArrayFromProperty(createdListItem, "weekdays"));
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
            Assert.Equal([1, 3, 5], GetIntArrayFromProperty(getPayload, "weekdays"));
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
                Assert.Equal(90, GetIntFromProperty(updateResponsePayload, "durationMinutes"));
                Assert.Equal([2, 4], GetIntArrayFromProperty(updateResponsePayload, "weekdays"));
            }
        }

        using (var assignResponse = await AssignTrainersToGroupAsync(
                   client,
                   $"/groups/{groupId}",
                   groupId,
                   new[] { seeded.CoachOneId, seeded.CoachTwoId },
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
                new[] { seeded.CoachOneId, seeded.CoachTwoId }.OrderBy(id => id).ToArray(),
                assignedGroup);
            Assert.Equal(
                new[] { seeded.CoachOneId, seeded.CoachTwoId }.OrderBy(id => id).ToArray(),
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
    public async Task Authenticated_crm_user_can_access_schedule_groups(string actorRole)
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
        Assert.Equal(2, payload.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, payload.GetProperty("skip").GetInt32());
        Assert.Equal(20, payload.GetProperty("take").GetInt32());
        Assert.Equal(2, GetArrayPayload(payload, "items").GetArrayLength());
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
    public async Task Coach_can_view_all_seeded_schedule_groups_without_group_management_access()
    {
        await using var factory = new GroupsAppFactory();
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

            Assert.Equal(2, payload.GetProperty("totalCount").GetInt32());
            Assert.Equal(0, payload.GetProperty("skip").GetInt32());
            Assert.Equal(10, payload.GetProperty("take").GetInt32());
            Assert.Equal(2, items.GetArrayLength());
            Assert.Equal(
                new[] { seeded.GroupOneId, seeded.GroupTwoId },
                items.EnumerateArray().Select(item => GetGuidFromProperty(item, "id")).ToArray());

            var firstItem = items[0];
            Assert.Equal(seeded.GroupOneId, GetGuidFromProperty(firstItem, "id"));
            Assert.Equal("Groups Branch", GetStringFromProperty(firstItem, "branchName"));
            Assert.Equal(seeded.BranchId, GetGuidFromProperty(firstItem, "branchId"));
            Assert.Equal("Groups Hall One", GetStringFromProperty(firstItem, "hallName"));
            Assert.Equal(seeded.HallOneId, GetGuidFromProperty(firstItem, "hallId"));
            Assert.Equal("Groups Default Type", GetStringFromProperty(firstItem, "groupTypeName"));
            Assert.Equal(seeded.GroupTypeId, GetGuidFromProperty(firstItem, "groupTypeId"));
            Assert.False(firstItem.TryGetProperty("groupType" + "System" + "Identifier", out _));
            Assert.Equal("09:00", GetStringFromProperty(firstItem, "trainingStartTime"));
            Assert.Equal(60, GetIntFromProperty(firstItem, "durationMinutes"));
            Assert.Equal([1, 3], GetIntArrayFromProperty(firstItem, "weekdays"));
            Assert.True(firstItem.GetProperty("isActive").GetBoolean());
            Assert.Equal(1, GetIntFromProperty(firstItem, "trainerCount"));
            Assert.Equal([seeded.CoachTwoId], GetGuidArrayFromProperty(firstItem, "trainerIds"));
            Assert.Equal(["Тренер 2 Stage 5"], GetStringArrayFromProperty(firstItem, "trainerNames"));
            Assert.Equal(1, GetIntFromProperty(firstItem, "clientCount"));

            var trainers = GetArrayPayload(firstItem, "trainers");
            Assert.Single(trainers.EnumerateArray());
            var trainer = trainers[0];
            Assert.Equal(seeded.CoachTwoId, GetGuidFromProperty(trainer, "id"));
            Assert.Equal("Тренер 2 Stage 5", GetStringFromProperty(trainer, "fullName"));
            Assert.Equal("coach-two-stage5", GetStringFromProperty(trainer, "login"));
        }

        using var managementResponse = await client.GetAsync("/groups");
        Assert.Equal(HttpStatusCode.Forbidden, managementResponse.StatusCode);
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
                   "/groups",
                   new
                   {
                       Name = "No branch hall",
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "18:00:00",
                       DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
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
                   "/groups",
                   new
                   {
                       Name = "Wrong hall",
                       BranchId = seeded.BranchId,
                       HallId = foreignHallId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "18:00:00",
                       DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, wrongHallResponse.StatusCode);
            var payload = await ReadJsonElementAsync(wrongHallResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("hallId", out _));
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
                   "/groups",
                   new
                   {
                       Name = "No group type",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallOneId,
                       TrainingStartTime = "18:00:00",
                       DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingGroupTypeResponse.StatusCode);
            var payload = await ReadJsonElementAsync(missingGroupTypeResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupTypeId", out _));
        }

        using (var unknownGroupTypeResponse = await PostJsonAsync(
                   client,
                   "/groups",
                   new
                   {
                       Name = "Unknown group type",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallOneId,
                       GroupTypeId = Guid.NewGuid(),
                       TrainingStartTime = "18:00:00",
                       DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
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
            "/groups",
            new
            {
                Name = "Missing schedule fields",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "18:00:00",
                IsActive = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");
        Assert.True(errors.TryGetProperty("durationMinutes", out _));
        Assert.True(errors.TryGetProperty("weekdays", out _));
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
            "/groups",
            new
            {
                Name = $"Invalid duration {durationMinutes}",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "18:00:00",
                DurationMinutes = durationMinutes,
                Weekdays = new[] { 1, 3 },
                IsActive = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        Assert.True(payload.GetProperty("errors").TryGetProperty("durationMinutes", out _));
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
            "/groups",
            new
            {
                Name = "Invalid weekdays",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "18:00:00",
                DurationMinutes = 60,
                Weekdays = new[] { 0, 3, 3, 8 },
                IsActive = true
            },
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");
        Assert.True(errors.TryGetProperty("weekdays", out var weekdaysErrors));
        Assert.True(weekdaysErrors.GetArrayLength() >= 2);
    }

    [Fact]
    public async Task Group_update_rejects_invalid_schedule_fields()
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

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var payload = await ReadJsonElementAsync(response);
        var errors = payload.GetProperty("errors");
        Assert.True(errors.TryGetProperty("durationMinutes", out _));
        Assert.True(errors.TryGetProperty("weekdays", out _));
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_group_types(string actorRole)
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
        var session = await LoginAsync(client, actorLogin, seeded.SharedPassword);

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

        using var createResponse = await PostJsonAsync(
            client,
            "/groups",
            new
            {
                Name = $"Audit group {Guid.NewGuid():N}",
                BranchId = seeded.BranchId,
                HallId = seeded.HallOneId,
                GroupTypeId = seeded.GroupTypeId,
                TrainingStartTime = "07:00:00",
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = true
            },
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
            AssertAuditSchedule(createLog.NewValueJson, 60, [1, 3]);
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
            AssertAuditSchedule(updateLog.OldValueJson, 60, [1, 3]);
            AssertAuditSchedule(updateLog.NewValueJson, 90, [2, 4]);
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
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/groups",
                   new
                   {
                       Name = "Coach Session Group",
                       BranchId = seeded.BranchId,
                       HallId = seeded.HallTwoId,
                       GroupTypeId = seeded.GroupTypeId,
                       TrainingStartTime = "12:00:00",
                       DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                       IsActive = true
                   },
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

        dbContext.Users.AddRange(headCoach, administrator, coachOne, coachTwo);
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
        var trainerPayload = new
        {
            TrainerIds = trainerIds
        };

        var dedicatedAssignResponse = await PutJsonAsync(
            client,
            $"{groupEndpointBase}/trainers",
            trainerPayload,
            csrfToken);

        if (dedicatedAssignResponse.StatusCode is not HttpStatusCode.NotFound)
        {
            return dedicatedAssignResponse;
        }

        dedicatedAssignResponse.Dispose();

        var fullPayload = new
        {
            TrainerIds = trainerIds
        };

        return await PutJsonAsync(
            client,
            $"/groups/{groupId}",
            fullPayload,
            csrfToken);
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

    private sealed record SeededGroupsData(
        Guid HeadCoachId,
        Guid AdministratorId,
        Guid CoachOneId,
        Guid CoachTwoId,
        string HeadCoachLogin,
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

    private sealed class GroupsAppFactory : WebApplicationFactory<Program>
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

                var databaseName = $"gym-crm-groups-tests-{Guid.NewGuid():N}";
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
