using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GymCrm.Tests;

public class ClientsApiTests
{
    private static readonly Guid TermCatalogItemId = Guid.Parse("20000000-0000-4000-8000-000000000001");
    private static readonly Guid SingleVisitCatalogItemId = Guid.Parse("20000000-0000-4000-8000-000000000002");
    private static readonly Guid ProfessionalCatalogItemId = Guid.Parse("20000000-0000-4000-8000-000000000003");
    private static readonly IReadOnlyDictionary<string, string[]> MembershipActionPathTemplates = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["purchase"] = ["/clients/{0}/membership/purchase", "/clients/{0}/memberships/purchase", "/clients/{0}/membership/new", "/clients/{0}/membership/NewPurchase"],
        ["renew"] = ["/clients/{0}/membership/renew", "/clients/{0}/memberships/renew", "/clients/{0}/membership/extension", "/clients/{0}/membership/renewal", "/clients/{0}/membership/extend"],
        ["correct"] = ["/clients/{0}/membership/correct", "/clients/{0}/memberships/correct", "/clients/{0}/membership/correction", "/clients/{0}/membership/update"],
        ["mark-payment"] = ["/clients/{0}/membership/mark-payment", "/clients/{0}/memberships/mark-payment", "/clients/{0}/membership/payment", "/clients/{0}/membership/pay", "/clients/{0}/membership/mark-payment-by-user"]
    };

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_client_lifecycle(string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
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

        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "Иванов",
                FirstName = "Иван",
                MiddleName = (string?)null,
                Phone = "+79990001122",
                BranchId = seeded.BranchId,
                Notes = "Первичная заметка по клиенту",
                Contacts = new[]
                {
                    new
                    {
                        Type = "Мама",
                        FullName = "Иванова Мария",
                        Phone = "+79990001123"
                    }
                },
                GroupIds = new[] { seeded.GroupOneId, seeded.GroupTwoId }
            },
            actorSession.CsrfToken);

        Assert.True(
            createResponse.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"Expected client create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        var clientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);

        using (var listResponse = await client.GetAsync("/clients?page=1&pageSize=1&status=Active"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");
            Assert.Equal(1, clientsPayload.GetArrayLength());
            Assert.Equal(clientId, GetGuidFromProperty(clientsPayload[0], "id"));
        }

        using (var getResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var getPayload = await ReadJsonElementAsync(getResponse);
            Assert.Equal(clientId, GetGuidFromProperty(getPayload, "id"));
            Assert.Equal("Иванов Иван", GetStringFromProperty(getPayload, "fullName"));
            Assert.Equal("+79990001122", GetStringFromProperty(getPayload, "phone"));
            Assert.Equal("Первичная заметка по клиенту", GetStringFromProperty(getPayload, "notes"));
            Assert.Equal(actorSession.User?.FullName, GetStringFromProperty(getPayload, "notesLastChangedByName"));
            var notesChangedAt = getPayload.GetProperty("notesLastChangedAt").GetDateTimeOffset();
            Assert.Equal(TimeSpan.Zero, notesChangedAt.Offset);
            Assert.Equal(0, notesChangedAt.Millisecond);
            Assert.Equal(JsonValueKind.Undefined, GetPropertyOrNull(getPayload, "notesChangedByUserId").ValueKind);
            Assert.DoesNotContain("login", getPayload.EnumerateObject().Select(property => property.Name), StringComparer.OrdinalIgnoreCase);
            var groupsPayload = GetArrayPayload(getPayload.GetProperty("groups"));
            Assert.Equal(2, groupsPayload.GetArrayLength());
            var groupOnePayload = groupsPayload.EnumerateArray()
                .Single(group => GetGuidFromProperty(group, "id") == seeded.GroupOneId);
            Assert.Equal(60, groupOnePayload.GetProperty("durationMinutes").GetInt32());
            Assert.Equal(
                [1, 3],
                groupOnePayload.GetProperty("weekdays").EnumerateArray().Select(weekday => weekday.GetInt32()).ToArray());
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{clientId}",
                   new
                   {
                       LastName = "",
                       FirstName = "Мария",
                       MiddleName = "Ивановна",
                       Phone = "+79990001199",
                       BranchId = seeded.BranchId,
                       Notes = "Обновленная заметка",
                       Contacts = new[]
                       {
                           new
                           {
                               Type = "Мама",
                               FullName = "Иванова Мария",
                               Phone = "+79990001200"
                           },
                           new
                           {
                               Type = "Папа",
                               FullName = "Иванов Петр",
                               Phone = "+79990001201"
                           }
                       },
                       GroupIds = new[] { seeded.GroupTwoId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updatePayload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal("Мария Ивановна", GetStringFromProperty(updatePayload, "fullName"));
            Assert.Equal("Active", GetStringFromProperty(updatePayload, "status"));
            Assert.Equal("Обновленная заметка", GetStringFromProperty(updatePayload, "notes"));
            Assert.Equal(2, GetArrayPayload(updatePayload.GetProperty("contacts")).GetArrayLength());
        }

        using (var reloadResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, reloadResponse.StatusCode);
            var reloadPayload = await ReadJsonElementAsync(reloadResponse);
            Assert.Equal("Обновленная заметка", GetStringFromProperty(reloadPayload, "notes"));
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var persistedClient = await dbContext.Clients
                .Include(candidate => candidate.Contacts)
                .Include(candidate => candidate.Groups)
                .SingleAsync(candidate => candidate.Id == clientId);

            Assert.Equal("+79990001199", persistedClient.Phone);
            Assert.Equal("Обновленная заметка", persistedClient.Notes);
            Assert.Equal(2, persistedClient.Contacts.Count);
            Assert.Equal(new[] { seeded.GroupTwoId }, persistedClient.Groups.Select(group => group.GroupId).ToArray());
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{clientId}/archive",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
            var archivePayload = await ReadJsonElementAsync(archiveResponse);
            Assert.Equal("Archived", GetStringFromProperty(archivePayload, "status"));
        }

        using (var archivedListResponse = await client.GetAsync("/clients?isArchived=true"))
        {
            Assert.Equal(HttpStatusCode.OK, archivedListResponse.StatusCode);
            var archivedListPayload = await ReadJsonElementAsync(archivedListResponse);
            var archivedClients = GetArrayPayload(archivedListPayload, "data", "items", "clients");
            Assert.Contains(
                archivedClients.EnumerateArray(),
                item => GetGuidFromProperty(item, "id") == clientId);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{clientId}/restore",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
            var restorePayload = await ReadJsonElementAsync(restoreResponse);
            Assert.Equal("Active", GetStringFromProperty(restorePayload, "status"));
        }
    }

    [Fact]
    public async Task Coach_has_read_only_list_access_and_cannot_manage_clients()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", actorSession.User?.Role);

        using (var listResponse = await client.GetAsync("/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");
            Assert.Equal(0, clientsPayload.GetArrayLength());
        }

        using (var getResponse = await client.GetAsync($"/clients/{seeded.ArchivedClientId}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);
        }

        using (var createResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       FirstName = "Forbidden",
                       Phone = "+79990008888",
                       BranchId = seeded.BranchId,
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, createResponse.StatusCode);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}",
                   new
                   {
                       FirstName = "Forbidden",
                       Phone = "+79990008888",
                       BranchId = seeded.BranchId,
                       GroupIds = Array.Empty<Guid>()
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}/archive",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, archiveResponse.StatusCode);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{seeded.ArchivedClientId}/restore",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.Forbidden, restoreResponse.StatusCode);
        }

        using (var searchByPhoneResponse = await client.GetAsync($"/clients?phone={Uri.EscapeDataString("+79990008888")}"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, searchByPhoneResponse.StatusCode);
        }

        using (var filterByGroupResponse = await client.GetAsync("/clients?groupId=00000000-0000-0000-0000-000000000001"))
        {
            Assert.Equal(HttpStatusCode.OK, filterByGroupResponse.StatusCode);
            var filterPayload = await ReadJsonElementAsync(filterByGroupResponse);
            var clientsPayload = GetArrayPayload(filterPayload, "data", "items", "clients");
            Assert.Equal(0, clientsPayload.GetArrayLength());
        }
    }

    [Fact]
    public async Task Client_transfer_changes_branch_requires_target_groups_preserves_membership_and_validates_target_group()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);

        Guid targetBranchId;
        Guid targetGroupId;
        Guid targetCatalogItemId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var targetBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Transfer Branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = targetBranch.Id,
                Name = "Transfer Hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetGroupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "Transfer Group Type",
                CreatedAt = now,
                UpdatedAt = now
            };
            var targetGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = targetBranch.Id,
                HallId = targetHall.Id,
                GroupTypeId = targetGroupType.Id,
                Name = "Transfer Group",
                TrainingStartTime = new TimeOnly(10, 0),
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Branches.Add(targetBranch);
            dbContext.Halls.Add(targetHall);
            dbContext.GroupTypes.Add(targetGroupType);
            dbContext.TrainingGroups.Add(targetGroup);
            var purchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var targetCatalogItem = MembershipCatalogItem.CreateBranchOwned(
                targetBranch.Id,
                "Transfer Term",
                1500m,
                MembershipBehaviorKind.Term,
                purchaseDate.AddYears(-1),
                null,
                now);
            dbContext.MembershipCatalogItems.Add(targetCatalogItem);
            dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                clientId,
                MembershipBehaviorKind.Term,
                purchaseDate,
                purchaseDate.AddMonths(1),
                1200m,
                isPaid: true,
                seeded.HeadCoachId,
                now));
            await dbContext.SaveChangesAsync();

            targetBranchId = targetBranch.Id;
            targetGroupId = targetGroup.Id;
            targetCatalogItemId = targetCatalogItem.Id;
        }

        using (var invalidTransferResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/transfer",
                   new
                   {
                       BranchId = targetBranchId,
                       GroupId = seeded.GroupOneId
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalidTransferResponse.StatusCode);
            var payload = await ReadJsonElementAsync(invalidTransferResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupIds", out _));
        }

        using (var transferWithoutGroupResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/transfer",
                   new
                   {
                       BranchId = targetBranchId,
                       GroupId = (Guid?)null
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, transferWithoutGroupResponse.StatusCode);
            var payload = await ReadJsonElementAsync(transferWithoutGroupResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupIds", out _));
        }

        using (var transferWithGroupResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/transfer",
                   new
                   {
                       BranchId = targetBranchId,
                       GroupIds = new[] { targetGroupId },
                       MembershipCatalogItemId = targetCatalogItemId,
                       ValidFrom = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                       ValidTo = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd"),
                       PaymentStatus = "Paid",
                       PaymentDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd")
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, transferWithGroupResponse.StatusCode);
            var payload = await ReadJsonElementAsync(transferWithGroupResponse);
            var groupIds = GetArrayPayload(payload.GetProperty("groupIds"))
                .EnumerateArray()
                .Select(item => Guid.Parse(item.GetString()!))
                .ToArray();
            Assert.Equal([targetGroupId], groupIds);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var persistedClient = await dbContext.Clients
                .Include(candidate => candidate.Groups)
                .Include(candidate => candidate.Memberships)
                .SingleAsync(candidate => candidate.Id == clientId);
            var activeBranchAssignment = await dbContext.ClientBranchAssignments
                .SingleAsync(assignment => assignment.ClientId == clientId && assignment.ValidTo == null);
            var activeGroupAssignments = await dbContext.ClientGroupAssignments
                .Where(assignment => assignment.ClientId == clientId && assignment.ValidTo == null)
                .ToArrayAsync();

            Assert.Equal(targetBranchId, persistedClient.BranchId);
            Assert.Equal([targetGroupId], persistedClient.Groups.Select(group => group.GroupId).ToArray());
            Assert.Single(persistedClient.Memberships.Where(membership => membership.ValidTo == null));
            Assert.Equal(targetBranchId, activeBranchAssignment.BranchId);
            Assert.Equal([targetGroupId], activeGroupAssignments.Select(assignment => assignment.GroupId).ToArray());
        }
    }

    [Fact]
    public async Task HeadCoach_can_upload_client_photo_and_details_include_photo_metadata()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);

        using (var uploadResponse = await PostPhotoAsync(
                   client,
                   clientId,
                   CreateSamplePngBytes(),
                   "profile.png",
                   "image/png",
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);

            var uploadPayload = await ReadJsonElementAsync(uploadResponse);
            Assert.Equal(clientId, GetGuidFromAnyCase(uploadPayload, "clientId", "ClientId"));
            Assert.Equal("image/png", GetStringFromAnyCase(uploadPayload, "contentType", "ContentType"));
        }

        using (var getClientResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getClientResponse.StatusCode);

            var clientPayload = await ReadJsonElementAsync(getClientResponse);
            var photoPayload = GetPropertyOrNull(clientPayload, "photo", "Photo");
            Assert.Equal("image/png", GetStringFromAnyCase(photoPayload, "contentType", "ContentType"));
            Assert.True(GetLongFromAnyCase(photoPayload, "sizeBytes", "SizeBytes") > 0);
            Assert.False(string.IsNullOrWhiteSpace(GetStringFromAnyCase(photoPayload, "path", "Path")));
            Assert.False(string.IsNullOrWhiteSpace(GetStringFromAnyCase(photoPayload, "uploadedAt", "UploadedAt")));
        }

        using (var photoResponse = await client.GetAsync($"/clients/{clientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.OK, photoResponse.StatusCode);
            Assert.Equal("image/png", photoResponse.Content.Headers.ContentType?.MediaType);
            Assert.NotEmpty(await photoResponse.Content.ReadAsByteArrayAsync());
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedClient = await dbContext.Clients
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == clientId);

        Assert.False(string.IsNullOrWhiteSpace(persistedClient.PhotoPath));
        Assert.Equal("image/png", persistedClient.PhotoContentType);
        Assert.True(persistedClient.PhotoSizeBytes > 0);
        Assert.NotNull(persistedClient.PhotoUploadedAt);
        Assert.True(File.Exists(ResolveStoredPhotoAbsolutePath(factory, persistedClient.PhotoPath!)));
    }

    [Theory]
    [InlineData("image/heic", "sample.heic")]
    [InlineData("image/heif", "sample.heif")]
    public async Task HeadCoach_can_upload_heic_or_heif_photo_and_it_is_converted_to_web_compatible_format(
        string contentType,
        string fileName)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);

        var photoContent = contentType == "image/heic"
            ? CreateSampleHeicBytes()
            : CreateSampleHeifBytes();

        using (var uploadResponse = await PostPhotoAsync(
                   client,
                   clientId,
                   photoContent,
                   fileName,
                   contentType,
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);

            var uploadPayload = await ReadJsonElementAsync(uploadResponse);
            Assert.Equal(clientId, GetGuidFromAnyCase(uploadPayload, "clientId", "ClientId"));
            Assert.Equal("image/jpeg", GetStringFromAnyCase(uploadPayload, "contentType", "ContentType"));
        }

        using (var getClientResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, getClientResponse.StatusCode);

            var clientPayload = await ReadJsonElementAsync(getClientResponse);
            var photoPayload = GetPropertyOrNull(clientPayload, "photo", "Photo");
            Assert.Equal("image/jpeg", GetStringFromAnyCase(photoPayload, "contentType", "ContentType"));
            Assert.True(GetLongFromAnyCase(photoPayload, "sizeBytes", "SizeBytes") > 0);
        }

        using (var photoResponse = await client.GetAsync($"/clients/{clientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.OK, photoResponse.StatusCode);
            Assert.Equal("image/jpeg", photoResponse.Content.Headers.ContentType?.MediaType);
            Assert.NotEmpty(await photoResponse.Content.ReadAsByteArrayAsync());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var persistedClient = await dbContext.Clients
                .AsNoTracking()
                .SingleAsync(candidate => candidate.Id == clientId);

            Assert.NotNull(persistedClient.PhotoPath);
            Assert.Equal("image/jpeg", persistedClient.PhotoContentType);
            Assert.True(persistedClient.PhotoSizeBytes > 0);
            Assert.EndsWith(".jpg", persistedClient.PhotoPath, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Uploading_too_large_client_photo_is_rejected_with_payload_too_large()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);
        var oversizedPayload = new byte[10 * 1024 * 1024 + 1];

        using (var uploadResponse = await PostPhotoAsync(
                   client,
                   clientId,
                   oversizedPayload,
                   "oversized.png",
                   "image/png",
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, uploadResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Uploading_invalid_client_photo_is_rejected()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);

        using var uploadResponse = await PostPhotoAsync(
            client,
            clientId,
            "not-an-image"u8.ToArray(),
            "profile.txt",
            "text/plain",
            session.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, uploadResponse.StatusCode);

        var payload = await ReadJsonElementAsync(uploadResponse);
        var errors = GetPropertyOrNull(payload, "errors", "Errors");
        Assert.Contains(
            errors.EnumerateObject(),
            property => property.NameEquals("photo") && property.Value.ValueKind == JsonValueKind.Array);
    }

    [Fact]
    public async Task Coach_can_view_photo_only_for_clients_from_assigned_groups()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var allowedClientId = await CreateClientForMembershipTestsAsync(
            managerClient,
            managerSession.CsrfToken,
            seeded.GroupOneId);
        var forbiddenClientId = await CreateClientForMembershipTestsAsync(
            managerClient,
            managerSession.CsrfToken,
            seeded.GroupTwoId);

        using (var uploadAllowedResponse = await PostPhotoAsync(
                   managerClient,
                   allowedClientId,
                   CreateSamplePngBytes(),
                   "allowed.png",
                   "image/png",
                   managerSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, uploadAllowedResponse.StatusCode);
        }

        using (var uploadForbiddenResponse = await PostPhotoAsync(
                   managerClient,
                   forbiddenClientId,
                   CreateSamplePngBytes(),
                   "forbidden.png",
                   "image/png",
                   managerSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, uploadForbiddenResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = seeded.GroupOneId,
                TrainerId = seeded.CoachId
            });
            await dbContext.SaveChangesAsync();
        }

        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using (var detailsResponse = await coachClient.GetAsync($"/clients/{allowedClientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, detailsResponse.StatusCode);

            var detailsPayload = await ReadJsonElementAsync(detailsResponse);
            Assert.Equal(string.Empty, GetStringFromProperty(detailsPayload, "phone"));
            Assert.Equal(0, GetArrayPayload(detailsPayload.GetProperty("contacts")).GetArrayLength());
            Assert.Equal(0, GetArrayPayload(detailsPayload, "membershipHistory", "MembershipHistory").GetArrayLength());
            Assert.False(string.IsNullOrWhiteSpace(
                GetStringFromAnyCase(GetPropertyOrNull(detailsPayload, "photo", "Photo"), "path", "Path")));
        }

        using (var allowedPhotoResponse = await coachClient.GetAsync($"/clients/{allowedClientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.OK, allowedPhotoResponse.StatusCode);
            Assert.Equal("image/png", allowedPhotoResponse.Content.Headers.ContentType?.MediaType);
        }

        using (var forbiddenPhotoResponse = await coachClient.GetAsync($"/clients/{forbiddenClientId}/photo"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenPhotoResponse.StatusCode);
        }
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_list_membership_attention_items_for_home_screen(
        string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(
            client,
            actorRole == "HeadCoach"
                ? seeded.HeadCoachLogin
                : seeded.AdministratorLogin,
            seeded.SharedPassword);

        async Task<Guid> CreateClientWithMembershipAsync(
            string lastName,
            MembershipBehaviorKind behaviorKind,
            DateOnly? expirationDate,
            bool isPaid = true,
            bool isProfessional = false,
            ClientStatus status = ClientStatus.Active,
            bool addCurrentMembership = true)
        {
            using var createResponse = await PostJsonAsync(
                client,
                "/clients",
                new
                {
                    LastName = lastName,
                    FirstName = "Тест",
                    MiddleName = "А",
                    Phone = $"+7999000{Guid.NewGuid():N}".Substring(0, 11),
                    BranchId = seeded.BranchId,
                    Contacts = Array.Empty<object>(),
                    GroupIds = new[] { seeded.GroupOneId }
                },
                actorSession.CsrfToken);

            Assert.True(
                createResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected client create success, got {createResponse.StatusCode}.");

            var createPayload = await ReadJsonElementAsync(createResponse);
            var createdClientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);

            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var createdClient = await dbContext.Clients.SingleAsync(candidate => candidate.Id == createdClientId);
            createdClient.Status = status;
            createdClient.UpdatedAt = now;

            if (addCurrentMembership)
            {
                dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                    createdClientId,
                    behaviorKind,
                    DateOnly.FromDateTime(DateTime.UtcNow.Date),
                    expirationDate,
                    1200m,
                    isPaid,
                    seeded.HeadCoachId,
                    now));
            }

            await dbContext.SaveChangesAsync();

            return createdClientId;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var recentlyExpiredUnpaidClient = await CreateClientWithMembershipAsync(
            "Alpha",
            MembershipBehaviorKind.Term,
            today.AddDays(-1),
            isPaid: false);
        var recentlyExpiredPaidClient = await CreateClientWithMembershipAsync(
            "Bravo",
            MembershipBehaviorKind.Term,
            today.AddDays(-3));
        var oldExpiredPaidClient = await CreateClientWithMembershipAsync(
            "Charlie",
            MembershipBehaviorKind.Term,
            today.AddDays(-40));
        var expiringTodayClient = await CreateClientWithMembershipAsync(
            "Delta",
            MembershipBehaviorKind.Term,
            today);
        var expiringSoonClient = await CreateClientWithMembershipAsync(
            "Echo",
            MembershipBehaviorKind.Term,
            today.AddDays(2));
        var laterExpiringClient = await CreateClientWithMembershipAsync(
            "Foxtrot",
            MembershipBehaviorKind.Term,
            today.AddDays(9));
        var unpaidOutsideWindowClient = await CreateClientWithMembershipAsync(
            "Golf",
            MembershipBehaviorKind.Term,
            today.AddDays(20),
            isPaid: false);
        var unpaidNoExpirationClient = await CreateClientWithMembershipAsync(
            "Hotel",
            MembershipBehaviorKind.SingleVisit,
            expirationDate: null,
            isPaid: false);
        var paidOutsideWindowClient = await CreateClientWithMembershipAsync(
            "Eta",
            MembershipBehaviorKind.Term,
            today.AddDays(10));
        var paidNoExpirationClient = await CreateClientWithMembershipAsync(
            "Omega",
            MembershipBehaviorKind.SingleVisit,
            expirationDate: null);
        var professionalClient = await CreateClientWithMembershipAsync(
            "Professional",
            MembershipBehaviorKind.Professional,
            expirationDate: null,
            isPaid: true,
            isProfessional: true);
        var archivedClient = await CreateClientWithMembershipAsync(
            "Archived",
            MembershipBehaviorKind.Term,
            today.AddDays(-2),
            isPaid: false,
            status: ClientStatus.Archived);
        var noMembershipClient = await CreateClientWithMembershipAsync(
            "NoMembership",
            MembershipBehaviorKind.Term,
            today.AddDays(-2),
            addCurrentMembership: false);

        using (var listResponse = await client.GetAsync("/clients/expiring-memberships"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");
            var clientItems = clientsPayload.EnumerateArray().ToArray();
            Assert.Equal(8, clientItems.Length);

            var resultClientIds = clientItems
                .Select(item => GetGuidFromAnyCase(item, "id", "Id", "clientId", "ClientId"))
                .ToArray();
            Assert.Contains(recentlyExpiredUnpaidClient, resultClientIds);
            Assert.Contains(recentlyExpiredPaidClient, resultClientIds);
            Assert.Contains(oldExpiredPaidClient, resultClientIds);
            Assert.Contains(expiringTodayClient, resultClientIds);
            Assert.Contains(expiringSoonClient, resultClientIds);
            Assert.Contains(laterExpiringClient, resultClientIds);
            Assert.Contains(unpaidOutsideWindowClient, resultClientIds);
            Assert.Contains(unpaidNoExpirationClient, resultClientIds);
            Assert.DoesNotContain(paidOutsideWindowClient, resultClientIds);
            Assert.DoesNotContain(paidNoExpirationClient, resultClientIds);
            Assert.DoesNotContain(professionalClient, resultClientIds);
            Assert.DoesNotContain(archivedClient, resultClientIds);
            Assert.DoesNotContain(noMembershipClient, resultClientIds);

            Assert.Equal(
                [
                    recentlyExpiredUnpaidClient,
                    recentlyExpiredPaidClient,
                    oldExpiredPaidClient,
                    expiringTodayClient,
                    expiringSoonClient,
                    laterExpiringClient,
                    unpaidOutsideWindowClient,
                    unpaidNoExpirationClient
                ],
                resultClientIds);

            var firstClient = clientItems[0];
            Assert.Equal("Alpha Тест А", GetStringFromAnyCase(firstClient, "fullName", "FullName"));
            Assert.Equal("Term", GetStringFromAnyCase(firstClient, "behaviorKind", "MembershipBehaviorKind"));
            Assert.Equal(today.AddDays(-1).ToString("yyyy-MM-dd"), GetStringFromAnyCase(firstClient, "expirationDate", "ExpirationDate"));
            Assert.Equal(-1L, GetLongFromAnyCase(firstClient, "daysUntilExpiration", "DaysUntilExpiration"));
            Assert.False(GetBoolFromAnyCase(firstClient, "isPaid", "IsPaid"));
            Assert.Equal("Expired", GetStringFromAnyCase(firstClient, "state", "State"));

            var expiringClient = clientItems[3];
            Assert.Equal("Delta Тест А", GetStringFromAnyCase(expiringClient, "fullName", "FullName"));
            Assert.Equal(today.ToString("yyyy-MM-dd"), GetStringFromAnyCase(expiringClient, "expirationDate", "ExpirationDate"));
            Assert.Equal(0L, GetLongFromAnyCase(expiringClient, "daysUntilExpiration", "DaysUntilExpiration"));
            Assert.True(GetBoolFromAnyCase(expiringClient, "isPaid", "IsPaid"));
            Assert.Equal("ExpiringSoon", GetStringFromAnyCase(expiringClient, "state", "State"));

            var unpaidOutsideWindow = clientItems[6];
            Assert.Equal("Golf Тест А", GetStringFromAnyCase(unpaidOutsideWindow, "fullName", "FullName"));
            Assert.Equal(today.AddDays(20).ToString("yyyy-MM-dd"), GetStringFromAnyCase(unpaidOutsideWindow, "expirationDate", "ExpirationDate"));
            Assert.Equal(20L, GetLongFromAnyCase(unpaidOutsideWindow, "daysUntilExpiration", "DaysUntilExpiration"));
            Assert.False(GetBoolFromAnyCase(unpaidOutsideWindow, "isPaid", "IsPaid"));
            Assert.Equal("Unpaid", GetStringFromAnyCase(unpaidOutsideWindow, "state", "State"));

            var unpaidWithoutDate = clientItems[7];
            Assert.Equal("Hotel Тест А", GetStringFromAnyCase(unpaidWithoutDate, "fullName", "FullName"));
            Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(unpaidWithoutDate, "expirationDate", "ExpirationDate").ValueKind);
            Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(unpaidWithoutDate, "daysUntilExpiration", "DaysUntilExpiration").ValueKind);
            Assert.False(GetBoolFromAnyCase(unpaidWithoutDate, "isPaid", "IsPaid"));
            Assert.Equal("Unpaid", GetStringFromAnyCase(unpaidWithoutDate, "state", "State"));
        }
    }

    [Fact]
    public async Task Coach_is_forbidden_from_expiring_memberships_home_endpoint()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);

        using var listResponse = await coachClient.GetAsync("/clients/expiring-memberships");
        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
    }

    [Fact]
    public async Task Coach_card_hides_phone_contacts_and_membership_payment_details()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var restrictedClientId = await CreateClientForMembershipTestsAsync(
            managerClient,
            managerSession.CsrfToken,
            seeded.GroupOneId);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = seeded.GroupOneId,
                TrainerId = seeded.CoachId
            });

            var restrictedClient = await dbContext.Clients
                .SingleAsync(client => client.Id == restrictedClientId);
            restrictedClient.Phone = "+79990001155";

            await dbContext.SaveChangesAsync();

            dbContext.ClientContacts.Add(new ClientContact
            {
                ClientId = restrictedClientId,
                Type = "Мама",
                FullName = "Редакция Контакта",
                Phone = "+79990001156"
            });

            await dbContext.SaveChangesAsync();
        }

        using (var purchaseResponse = await SendMembershipActionAsync(
                   managerClient,
                   "purchase",
                   restrictedClientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1200m,
                       IsPaid = true,
                       SingleVisitUsed = false
                   },
                   managerSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected membership purchase success, got {purchaseResponse.StatusCode}.");
        }

        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using var clientResponse = await coachClient.GetAsync($"/clients/{restrictedClientId}");
        Assert.Equal(HttpStatusCode.OK, clientResponse.StatusCode);

        var clientPayload = await ReadJsonElementAsync(clientResponse);
        Assert.Equal(string.Empty, GetStringFromProperty(clientPayload, "phone"));

        var contactsPayload = GetPropertyOrNull(clientPayload, "contacts", "Contacts");
        Assert.Equal(0, contactsPayload.ValueKind == JsonValueKind.Array ? contactsPayload.GetArrayLength() : 0);

        var currentMembershipPayload = GetPropertyOrNull(clientPayload, "currentMembership", "CurrentMembership");
        Assert.True(
            currentMembershipPayload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null,
            "Coach should not receive current membership payload.");

        var membershipHistoryPayload = GetArrayPayloadOrEmpty(
            clientPayload,
            "membershipHistory",
            "MembershipHistory",
            "membershipHistoryItems",
            "MembershipHistoryItems");
        Assert.Empty(membershipHistoryPayload);

        Assert.False(HasAnyProperty(clientPayload, "paymentAmount", "paymentDate", "paidByUserId", "paidAt"));
        Assert.False(HasAnyProperty(
            clientPayload,
            "PaymentAmount",
            "PaymentDate",
            "PaidByUserId",
            "PaidAt"));
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task Elevated_roles_see_full_client_card_and_attendance_history(string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(managerClient, managerSession.CsrfToken, seeded.GroupOneId);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientId,
                GroupId = seeded.GroupTwoId,
                BranchId = seeded.BranchId
            });

            await dbContext.SaveChangesAsync();

            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupOneId, seeded.HeadCoachId, DateOnly.FromDateTime(DateTime.UtcNow.Date), true);
            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupTwoId, seeded.HeadCoachId, DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-1)), true);

            await dbContext.SaveChangesAsync();
        }

        using (var purchaseResponse = await SendMembershipActionAsync(
                   managerClient,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-2)).ToString("yyyy-MM-dd"),
                       ExpirationDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddMonths(1)).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1600m,
                       IsPaid = true,
                       SingleVisitUsed = false
                   },
                   managerSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected membership purchase success, got {purchaseResponse.StatusCode}.");
        }

        var actorSession = await LoginAsync(
            managerClient,
            actorRole == "HeadCoach" ? seeded.HeadCoachLogin : seeded.AdministratorLogin,
            seeded.SharedPassword);
        Assert.Equal(actorRole, actorSession.User?.Role);

        using var cardResponse = await managerClient.GetAsync($"/clients/{clientId}");
        Assert.Equal(HttpStatusCode.OK, cardResponse.StatusCode);

        var clientPayload = await ReadJsonElementAsync(cardResponse);
        Assert.NotEqual(string.Empty, GetStringFromProperty(clientPayload, "phone"));

        var membershipHistoryPayload = GetArrayPayloadOrEmpty(
            clientPayload,
            "membershipHistory",
            "MembershipHistory",
            "membershipHistoryItems",
            "MembershipHistoryItems");
        Assert.NotEmpty(membershipHistoryPayload);

        var currentMembershipPayload = GetPropertyOrNull(clientPayload, "currentMembership", "CurrentMembership");
        Assert.Equal(JsonValueKind.Object, currentMembershipPayload.ValueKind);
        Assert.True(GetDecimalFromAnyCase(currentMembershipPayload, "paymentAmount", "PaymentAmount") > 0m);
        Assert.True(GetGuidFromAnyCase(currentMembershipPayload, "paidByUserId", "PaidByUserId") != Guid.Empty);

        var attendanceHistoryPayload = GetArrayPayloadOrEmpty(
            clientPayload,
            "attendanceHistory",
            "AttendanceHistory",
            "attendanceHistoryItems",
            "AttendanceHistoryItems");
        Assert.Equal(2, attendanceHistoryPayload.Count);

        var seenGroupIds = attendanceHistoryPayload
            .Select(TryGetAttendanceGroupId)
            .Where(groupId => groupId.HasValue)
            .Select(groupId => groupId!.Value)
            .ToHashSet();

        Assert.Contains(seeded.GroupOneId, seenGroupIds);
        Assert.Contains(seeded.GroupTwoId, seenGroupIds);
    }

    [Fact]
    public async Task Coach_sees_attendance_history_only_for_assigned_groups_in_client_card()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(managerClient, managerSession.CsrfToken, seeded.GroupOneId);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

            dbContext.ClientGroups.Add(new ClientGroup
            {
                ClientId = clientId,
                GroupId = seeded.GroupTwoId,
                BranchId = seeded.BranchId
            });

            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = seeded.GroupOneId,
                TrainerId = seeded.CoachId
            });

            await dbContext.SaveChangesAsync();

            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupOneId, seeded.HeadCoachId, DateOnly.FromDateTime(DateTime.UtcNow.Date), true);
            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupTwoId, seeded.HeadCoachId, DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-1)), true);

            await dbContext.SaveChangesAsync();
        }

        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using var coachCardResponse = await coachClient.GetAsync($"/clients/{clientId}");
        Assert.Equal(HttpStatusCode.OK, coachCardResponse.StatusCode);

        var coachPayload = await ReadJsonElementAsync(coachCardResponse);
        var attendanceHistoryPayload = GetArrayPayloadOrEmpty(
            coachPayload,
            "attendanceHistory",
            "AttendanceHistory",
            "attendanceHistoryItems",
            "AttendanceHistoryItems");

        Assert.Single(attendanceHistoryPayload);
        Assert.All(
            attendanceHistoryPayload,
            item =>
            {
                Assert.Equal(seeded.GroupOneId, TryGetAttendanceGroupId(item) ?? Guid.Empty);

                var propertyNames = item.EnumerateObject()
                    .Select(property => property.Name)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                Assert.Equal(
                    new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "id",
                        "trainingDate",
                        "isPresent",
                        "groupId",
                        "groupName",
                        "groupTrainingStartTime",
                        "groupDurationMinutes",
                        "groupWeekdays"
                    },
                    propertyNames);
            });
    }

    [Fact]
    public async Task Client_card_attendance_history_supports_partial_loading_and_validates_paging()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();

            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupOneId, seeded.HeadCoachId, today, true);
            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(-1), false);
            SeedAttendanceEntryForClient(dbContext, clientId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(-2), true);

            await dbContext.SaveChangesAsync();
        }

        using (var pagedResponse = await client.GetAsync($"/clients/{clientId}?attendanceSkip=1&attendanceTake=1"))
        {
            Assert.Equal(HttpStatusCode.OK, pagedResponse.StatusCode);

            var pagedPayload = await ReadJsonElementAsync(pagedResponse);
            var attendanceHistoryPayload = GetArrayPayloadOrEmpty(
                pagedPayload,
                "attendanceHistory",
                "AttendanceHistory",
                "attendanceHistoryItems",
                "AttendanceHistoryItems");

            Assert.Single(attendanceHistoryPayload);
            Assert.Equal(1, GetLongFromAnyCase(pagedPayload, "attendanceHistorySkip", "AttendanceHistorySkip"));
            Assert.Equal(1, GetLongFromAnyCase(pagedPayload, "attendanceHistoryTake", "AttendanceHistoryTake"));
            Assert.Equal(3, GetLongFromAnyCase(pagedPayload, "attendanceHistoryTotalCount", "AttendanceHistoryTotalCount"));
            Assert.True(GetBoolFromAnyCase(pagedPayload, "attendanceHistoryHasMore", "AttendanceHistoryHasMore"));
            Assert.Equal(today.AddDays(-1).ToString("yyyy-MM-dd"), GetStringFromAnyCase(attendanceHistoryPayload[0], "trainingDate", "TrainingDate"));
        }

        using var invalidResponse = await client.GetAsync($"/clients/{clientId}?attendanceTake=0");
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);

        var invalidPayload = await ReadJsonElementAsync(invalidResponse);
        var errorsPayload = GetPropertyOrNull(invalidPayload, "errors", "Errors");
        Assert.True(
            GetPropertyOrNull(errorsPayload, "attendanceTake", "AttendanceTake").ValueKind == JsonValueKind.Array,
            "Expected validation error for attendanceTake.");
    }

    [Fact]
    public async Task Coach_list_is_scoped_to_assigned_groups_and_hides_sensitive_fields()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var managerClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(managerClient, seeded.HeadCoachLogin, seeded.SharedPassword);
        var allowedClientId = await CreateClientForMembershipTestsAsync(
            managerClient,
            managerSession.CsrfToken,
            seeded.GroupOneId);
        var forbiddenClientId = await CreateClientForMembershipTestsAsync(
            managerClient,
            managerSession.CsrfToken,
            seeded.GroupTwoId);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.GroupTrainers.Add(new GroupTrainer
            {
                GroupId = seeded.GroupOneId,
                TrainerId = seeded.CoachId
            });
            var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var now = DateTimeOffset.UtcNow;
            dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                allowedClientId,
                MembershipBehaviorKind.Term,
                today,
                today.AddDays(10),
                3500m,
                isPaid: true,
                seeded.HeadCoachId,
                now));
            SeedAttendanceEntryForClient(
                dbContext,
                allowedClientId,
                seeded.GroupOneId,
                seeded.HeadCoachId,
                today.AddDays(-3),
                true);
            SeedAttendanceEntryForClient(
                dbContext,
                allowedClientId,
                seeded.GroupTwoId,
                seeded.HeadCoachId,
                today.AddDays(-1),
                true);
            await dbContext.SaveChangesAsync();
        }

        var coachSession = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);
        Assert.Equal("Coach", coachSession.User?.Role);

        using (var listResponse = await coachClient.GetAsync("/clients"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");

            Assert.Single(clientsPayload.EnumerateArray());

            var clientPayload = clientsPayload[0];
            Assert.Equal(allowedClientId, GetGuidFromProperty(clientPayload, "id"));
            Assert.NotEqual(forbiddenClientId, GetGuidFromProperty(clientPayload, "id"));
            Assert.Equal(string.Empty, GetStringFromProperty(clientPayload, "phone"));
            Assert.Equal(0, clientPayload.GetProperty("contactCount").GetInt32());
            Assert.Equal("Term", GetStringFromAnyCase(
                GetPropertyOrNull(clientPayload, "currentMembershipSummary", "CurrentMembershipSummary"),
                "behaviorKind",
                "MembershipBehaviorKind"));
            Assert.False(HasAnyProperty(
                GetPropertyOrNull(clientPayload, "currentMembershipSummary", "CurrentMembershipSummary"),
                "paymentAmount",
                "PaymentAmount",
                "paidByUserId",
                "PaidByUserId",
                "paidAt",
                "PaidAt"));
            Assert.Equal(
                DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-3).ToString("yyyy-MM-dd"),
                GetStringFromAnyCase(clientPayload, "lastVisitDate", "LastVisitDate"));

            var groupsPayload = GetArrayPayload(clientPayload.GetProperty("groups"));
            Assert.Single(groupsPayload.EnumerateArray());
            Assert.Equal(seeded.GroupOneId, GetGuidFromProperty(groupsPayload[0], "id"));
        }

        using (var phoneQueryResponse = await coachClient.GetAsync("/clients?query=7999000"))
        {
            Assert.Equal(HttpStatusCode.OK, phoneQueryResponse.StatusCode);
            var phoneQueryPayload = await ReadJsonElementAsync(phoneQueryResponse);
            Assert.Empty(GetArrayPayload(phoneQueryPayload, "items", "clients").EnumerateArray());
        }

        using (var filteredResponse = await coachClient.GetAsync($"/clients?groupId={seeded.GroupOneId}"))
        {
            Assert.Equal(HttpStatusCode.OK, filteredResponse.StatusCode);
            var filteredPayload = await ReadJsonElementAsync(filteredResponse);
            var clientsPayload = GetArrayPayload(filteredPayload, "data", "items", "clients");
            Assert.Single(clientsPayload.EnumerateArray());
            Assert.Equal(allowedClientId, GetGuidFromProperty(clientsPayload[0], "id"));
        }
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_search_and_filter_clients_for_list_queries(string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(
            client,
            actorRole == "HeadCoach"
                ? seeded.HeadCoachLogin
                : seeded.AdministratorLogin,
            seeded.SharedPassword);
        using var headCoachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var headCoachSession = await LoginAsync(headCoachClient, seeded.HeadCoachLogin, seeded.SharedPassword);

        async Task<Guid> CreateClientForFilterAsync(
            string lastName,
            string firstName,
            string phone,
            Guid[] groupIds)
        {
            using var createResponse = await PostJsonAsync(
                client,
                "/clients",
                new
                {
                    LastName = lastName,
                    FirstName = firstName,
                    MiddleName = "Тест",
                    Phone = phone,
                    BranchId = seeded.BranchId,
                    Contacts = Array.Empty<object>(),
                    GroupIds = groupIds
                },
                actorSession.CsrfToken);

            Assert.True(
                createResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected client create success, got {createResponse.StatusCode}.");

            var createPayload = await ReadJsonElementAsync(createResponse);
            return await ExtractClientIdFromResponseAsync(createResponse, createPayload);
        }

        async Task<Guid[]> QueryClientIdsAsync(string query)
        {
            using var listResponse = await client.GetAsync($"/clients{query}");
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);

            return GetArrayPayload(listPayload, "data", "items", "clients")
                .EnumerateArray()
                .Select(candidate => GetGuidFromProperty(candidate, "id"))
                .Where(id => id != Guid.Empty)
                .ToArray();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        async Task SeedCurrentMembershipsAsync(
            Guid clientId,
            params (DateOnly? IndividualValidTo, int ValidFromOffsetMinutes, MembershipBehaviorKind BehaviorKind, bool IsPaid)[] memberships)
        {
            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var baseTimestamp = DateTimeOffset.UtcNow;

            foreach (var membership in memberships)
            {
                var validFrom = baseTimestamp.AddMinutes(membership.ValidFromOffsetMinutes);

                dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                    clientId,
                    membership.BehaviorKind,
                    today,
                    membership.IndividualValidTo,
                    1000m,
                    membership.IsPaid,
                    seeded.HeadCoachId,
                    validFrom));
            }

            await dbContext.SaveChangesAsync();
        }

        var paidClientId = await CreateClientForFilterAsync("Иванов", "Платный", "+79990004001", [seeded.GroupOneId]);
        var unpaidClientId = await CreateClientForFilterAsync("Петров", "Неоплаченный", "+79990004002", [seeded.GroupTwoId]);
        var professionalClientId = await CreateClientForFilterAsync("Профессионалов", "Льготный", "+79990004004", [seeded.GroupOneId]);
        var noGroupNoPhotoClientId = await CreateClientForFilterAsync("Сидоров", "Без", "+79990004003", [seeded.GroupTwoId]);

        using (var paidPhotoResponse = await PostPhotoAsync(
                   client,
                   paidClientId,
                   CreateSamplePngBytes(),
                   "paid.png",
                   "image/png",
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, paidPhotoResponse.StatusCode);
        }

        using (var paidMembershipResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   paidClientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = today.ToString("yyyy-MM-dd"),
                       ExpirationDate = today.AddDays(5).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, paidMembershipResponse.StatusCode);
        }

        using (var unpaidMembershipResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   unpaidClientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = today.ToString("yyyy-MM-dd"),
                       ExpirationDate = today.AddMonths(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 500m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, unpaidMembershipResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                professionalClientId,
                MembershipBehaviorKind.Professional,
                today,
                null,
                0m,
                isPaid: true,
                seeded.HeadCoachId,
                DateTimeOffset.UtcNow,
                professionalComment: "Фильтры должны считать клиента оплаченным"));
            await dbContext.SaveChangesAsync();
        }

        var fullNameSearch = await QueryClientIdsAsync($"?fullName={Uri.EscapeDataString("Иванов")}");
        Assert.Single(fullNameSearch);
        Assert.Equal(paidClientId, fullNameSearch[0]);

        var phoneSearch = await QueryClientIdsAsync($"?phone={Uri.EscapeDataString("+79990004002")}");
        Assert.Single(phoneSearch);
        Assert.Equal(unpaidClientId, phoneSearch[0]);

        var unifiedNameSearch = await QueryClientIdsAsync($"?query={Uri.EscapeDataString("Иванов")}");
        Assert.Single(unifiedNameSearch);
        Assert.Equal(paidClientId, unifiedNameSearch[0]);

        var unifiedPhoneSearch = await QueryClientIdsAsync($"?query={Uri.EscapeDataString("+79990004002")}");
        Assert.Single(unifiedPhoneSearch);
        Assert.Equal(unpaidClientId, unifiedPhoneSearch[0]);

        var searchAlias = await QueryClientIdsAsync($"?search={Uri.EscapeDataString("+79990004002")}");
        Assert.Single(searchAlias);
        Assert.Equal(unpaidClientId, searchAlias[0]);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            SeedAttendanceEntryForClient(
                dbContext,
                paidClientId,
                seeded.GroupOneId,
                seeded.HeadCoachId,
                today,
                false);
            SeedAttendanceEntryForClient(
                dbContext,
                paidClientId,
                seeded.GroupOneId,
                seeded.HeadCoachId,
                today.AddDays(-1),
                true);
            await dbContext.SaveChangesAsync();
        }

        using (var lastVisitResponse = await client.GetAsync($"/clients?query={Uri.EscapeDataString("+79990004001")}"))
        {
            Assert.Equal(HttpStatusCode.OK, lastVisitResponse.StatusCode);
            var lastVisitPayload = await ReadJsonElementAsync(lastVisitResponse);
            var clientsPayload = GetArrayPayload(lastVisitPayload, "items", "clients");
            Assert.Single(clientsPayload.EnumerateArray());
            Assert.Equal(
                today.AddDays(-1).ToString("yyyy-MM-dd"),
                GetStringFromAnyCase(clientsPayload[0], "lastVisitDate", "LastVisitDate"));
        }

        using (var membershipSummaryResponse = await client.GetAsync($"/clients?query={Uri.EscapeDataString("+79990004001")}"))
        {
            Assert.Equal(HttpStatusCode.OK, membershipSummaryResponse.StatusCode);
            var membershipSummaryPayload = await ReadJsonElementAsync(membershipSummaryResponse);
            var clientsPayload = GetArrayPayload(membershipSummaryPayload, "items", "clients");
            var summaryPayload = GetPropertyOrNull(
                clientsPayload[0],
                "currentMembershipSummary",
                "CurrentMembershipSummary");
            Assert.Equal("Term", GetStringFromAnyCase(summaryPayload, "behaviorKind", "MembershipBehaviorKind"));
            Assert.False(HasAnyProperty(summaryPayload, "paymentAmount", "PaymentAmount"));
            Assert.True(GetBoolFromAnyCase(clientsPayload[0], "hasCurrentMembership", "HasCurrentMembership"));
        }

        var activeStatus = await QueryClientIdsAsync("?status=Active");
        Assert.Contains(paidClientId, activeStatus);
        Assert.Contains(unpaidClientId, activeStatus);
        Assert.Contains(professionalClientId, activeStatus);
        Assert.Contains(noGroupNoPhotoClientId, activeStatus);

        var groupOneClients = await QueryClientIdsAsync($"?groupId={seeded.GroupOneId}");
        Assert.Contains(paidClientId, groupOneClients);
        Assert.Contains(professionalClientId, groupOneClients);

        var activePaid = await QueryClientIdsAsync("?paymentStatus=Paid");
        Assert.Contains(paidClientId, activePaid);
        Assert.Contains(professionalClientId, activePaid);
        Assert.DoesNotContain(unpaidClientId, activePaid);

        var unpaidStatus = await QueryClientIdsAsync("?paymentStatus=Unpaid");
        Assert.Contains(unpaidClientId, unpaidStatus);
        Assert.DoesNotContain(professionalClientId, unpaidStatus);

        var membershipRange = await QueryClientIdsAsync(
            $"?membershipExpiresFrom={today.AddDays(25):yyyy-MM-dd}&membershipExpiresTo={today.AddDays(35):yyyy-MM-dd}");
        Assert.DoesNotContain(paidClientId, membershipRange);
        Assert.Contains(unpaidClientId, membershipRange);
        Assert.DoesNotContain(noGroupNoPhotoClientId, membershipRange);

        var withPhoto = await QueryClientIdsAsync("?hasPhoto=true");
        Assert.Single(withPhoto);
        Assert.Equal(paidClientId, withPhoto[0]);

        var withoutPhoto = await QueryClientIdsAsync("?hasPhoto=false");
        Assert.Contains(unpaidClientId, withoutPhoto);
        Assert.Contains(noGroupNoPhotoClientId, withoutPhoto);
        Assert.DoesNotContain(paidClientId, withoutPhoto);

        var withoutGroup = await QueryClientIdsAsync("?hasGroup=false&status=Active");
        Assert.Empty(withoutGroup);

        var withoutActivePaid = await QueryClientIdsAsync("?hasActivePaidMembership=false");
        Assert.Contains(unpaidClientId, withoutActivePaid);
        Assert.Contains(noGroupNoPhotoClientId, withoutActivePaid);
        Assert.DoesNotContain(paidClientId, withoutActivePaid);
        Assert.DoesNotContain(professionalClientId, withoutActivePaid);

        var activeMembershipState = await QueryClientIdsAsync("?membershipState=ActivePaid");
        Assert.Contains(paidClientId, activeMembershipState);
        Assert.Contains(professionalClientId, activeMembershipState);

        var unpaidMembershipState = await QueryClientIdsAsync("?membershipState=Unpaid");
        Assert.Contains(unpaidClientId, unpaidMembershipState);
        Assert.DoesNotContain(professionalClientId, unpaidMembershipState);

        var withoutCurrentMembership = await QueryClientIdsAsync("?hasCurrentMembership=false");
        Assert.Contains(noGroupNoPhotoClientId, withoutCurrentMembership);
        Assert.DoesNotContain(paidClientId, withoutCurrentMembership);
        Assert.DoesNotContain(unpaidClientId, withoutCurrentMembership);

        var earlyAlphabetClientId = await CreateClientForFilterAsync("Аарон", "Ранний", "+79990004010", [seeded.GroupOneId]);
        var staleCurrentMembershipClientId = await CreateClientForFilterAsync("Борисов", "Спорный", "+79990004011", [seeded.GroupOneId]);
        var firstFilteredPageClientId = await CreateClientForFilterAsync("Викторов", "Первый", "+79990004012", [seeded.GroupOneId]);
        var secondFilteredPageClientId = await CreateClientForFilterAsync("Громов", "Второй", "+79990004013", [seeded.GroupOneId]);

        await SeedCurrentMembershipsAsync(
            earlyAlphabetClientId,
            (today.AddDays(5), 1, MembershipBehaviorKind.SingleVisit, true));
        await SeedCurrentMembershipsAsync(
            staleCurrentMembershipClientId,
            (today.AddDays(28), 1, MembershipBehaviorKind.SingleVisit, true),
            (today.AddDays(40), 2, MembershipBehaviorKind.SingleVisit, true));
        await SeedCurrentMembershipsAsync(
            firstFilteredPageClientId,
            (today.AddDays(29), 1, MembershipBehaviorKind.Term, true));
        await SeedCurrentMembershipsAsync(
            secondFilteredPageClientId,
            (today.AddDays(32), 1, MembershipBehaviorKind.Term, false));

        var membershipFilterQuery =
            $"?membershipExpiresFrom={today.AddDays(25):yyyy-MM-dd}&membershipExpiresTo={today.AddDays(35):yyyy-MM-dd}";
        var filteredMembershipRange = await QueryClientIdsAsync(membershipFilterQuery);
        Assert.Contains(firstFilteredPageClientId, filteredMembershipRange);
        Assert.Contains(secondFilteredPageClientId, filteredMembershipRange);
        Assert.DoesNotContain(earlyAlphabetClientId, filteredMembershipRange);
        Assert.DoesNotContain(staleCurrentMembershipClientId, filteredMembershipRange);

        var firstMembershipPage = await QueryClientIdsAsync($"{membershipFilterQuery}&page=1&pageSize=1");
        Assert.Single(firstMembershipPage);
        Assert.Equal(firstFilteredPageClientId, firstMembershipPage[0]);

        var secondMembershipPage = await QueryClientIdsAsync($"{membershipFilterQuery}&page=2&pageSize=1");
        Assert.Single(secondMembershipPage);
        Assert.Equal(secondFilteredPageClientId, secondMembershipPage[0]);

        var singleVisitClients = await QueryClientIdsAsync("?behaviorKind=SingleVisit");
        Assert.Contains(earlyAlphabetClientId, singleVisitClients);
        Assert.DoesNotContain(firstFilteredPageClientId, singleVisitClients);
        Assert.DoesNotContain(paidClientId, singleVisitClients);

        var countActiveClientId = await CreateClientForFilterAsync("Счетчик", "Актив", "+79990004101", [seeded.GroupOneId]);
        var countArchivedClientId = await CreateClientForFilterAsync("Счетчик", "Архив", "+79990004102", [seeded.GroupTwoId]);
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var archivedClient = await dbContext.Clients.SingleAsync(candidate => candidate.Id == countArchivedClientId);
            archivedClient.Status = ClientStatus.Archived;
            archivedClient.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        using (var envelopeResponse = await client.GetAsync($"/clients?query={Uri.EscapeDataString("Счетчик")}&status=Active&page=1&pageSize=1"))
        {
            Assert.Equal(HttpStatusCode.OK, envelopeResponse.StatusCode);
            var envelopePayload = await ReadJsonElementAsync(envelopeResponse);
            Assert.True(GetPropertyOrNull(envelopePayload, "items", "Items").ValueKind == JsonValueKind.Array);
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "totalCount", "TotalCount"));
            Assert.Equal(0, GetLongFromAnyCase(envelopePayload, "skip", "Skip"));
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "take", "Take"));
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "page", "Page"));
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "pageSize", "PageSize"));
            Assert.False(GetBoolFromAnyCase(envelopePayload, "hasNextPage", "HasNextPage"));
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "activeCount", "ActiveCount"));
            Assert.Equal(1, GetLongFromAnyCase(envelopePayload, "archivedCount", "ArchivedCount"));
            Assert.Equal(countActiveClientId, GetGuidFromProperty(GetArrayPayload(envelopePayload, "items", "clients")[0], "id"));
        }
    }

    [Fact]
    public async Task Client_list_returns_quick_filter_counts_and_backend_ordered_action_hints()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        async Task<Guid> CreateClientForQuickFilterAsync(
            string lastName,
            string firstName,
            string phone,
            Guid[] groupIds)
        {
            using var createResponse = await PostJsonAsync(
                client,
                "/clients",
                new
                {
                    LastName = lastName,
                    FirstName = firstName,
                    Phone = phone,
                    BranchId = seeded.BranchId,
                    Contacts = Array.Empty<object>(),
                    GroupIds = groupIds
                },
                session.CsrfToken);

            Assert.True(
                createResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected client create success, got {createResponse.StatusCode}.");

            var createPayload = await ReadJsonElementAsync(createResponse);
            return await ExtractClientIdFromResponseAsync(createResponse, createPayload);
        }

        var withoutMembershipNoGroupClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "WithoutMembership NoGroup",
            "+79990005001",
            [seeded.GroupOneId]);
        var withoutMembershipClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "WithoutMembership Grouped",
            "+79990005002",
            [seeded.GroupOneId]);
        var expiringClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "Expiring",
            "+79990005003",
            [seeded.GroupOneId]);
        var expiredTrialClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "Trial",
            "+79990005004",
            [seeded.GroupOneId]);
        var unpaidClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "Unpaid",
            "+79990005005",
            [seeded.GroupOneId]);
        var normalClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "Normal",
            "+79990005006",
            [seeded.GroupOneId]);
        var professionalClientId = await CreateClientForQuickFilterAsync(
            "QuickFilter",
            "Professional",
            "+79990005007",
            [seeded.GroupOneId]);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var noGroupAssignments = await dbContext.ClientGroups
                .Where(clientGroup => clientGroup.ClientId == withoutMembershipNoGroupClientId)
                .ToArrayAsync();
            var noGroupAssignmentHistory = await dbContext.ClientGroupAssignments
                .Where(clientGroup => clientGroup.ClientId == withoutMembershipNoGroupClientId)
                .ToArrayAsync();

            dbContext.ClientGroups.RemoveRange(noGroupAssignments);
            dbContext.ClientGroupAssignments.RemoveRange(noGroupAssignmentHistory);

            dbContext.ClientMemberships.AddRange(
                CreateMembershipWithSale(
                    expiringClientId,
                    MembershipBehaviorKind.Term,
                    today,
                    today.AddDays(2),
                    1000m,
                    isPaid: true,
                    seeded.HeadCoachId,
                    now),
                CreateMembershipWithSale(
                    expiredTrialClientId,
                    MembershipBehaviorKind.SingleVisit,
                    today.AddDays(-20),
                    today.AddDays(-1),
                    500m,
                    isPaid: true,
                    seeded.HeadCoachId,
                    now.AddMinutes(1),
                    singleVisitUsed: true),
                CreateMembershipWithSale(
                    unpaidClientId,
                    MembershipBehaviorKind.Term,
                    today,
                    today.AddDays(30),
                    1000m,
                    isPaid: false,
                    seeded.HeadCoachId,
                    now.AddMinutes(2)),
                CreateMembershipWithSale(
                    normalClientId,
                    MembershipBehaviorKind.Term,
                    today,
                    today.AddDays(40),
                    1000m,
                    isPaid: true,
                    seeded.HeadCoachId,
                    now.AddMinutes(3)),
                CreateMembershipWithSale(
                    professionalClientId,
                    MembershipBehaviorKind.Professional,
                    today,
                    null,
                    0m,
                    isPaid: true,
                    seeded.HeadCoachId,
                    now.AddMinutes(4),
                    professionalComment: "Льготный клиент"));

            await dbContext.SaveChangesAsync();
        }

        using (var listResponse = await client.GetAsync("/clients?status=Active&page=1&pageSize=20"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            var listPayload = await ReadJsonElementAsync(listResponse);
            var quickFilterCounts = GetPropertyOrNull(listPayload, "quickFilterCounts", "QuickFilterCounts");

            Assert.Equal(2, GetLongFromAnyCase(quickFilterCounts, "withoutMembership", "WithoutMembership"));
            Assert.Equal(1, GetLongFromAnyCase(quickFilterCounts, "expiringSoon", "ExpiringSoon"));
            Assert.Equal(1, GetLongFromAnyCase(quickFilterCounts, "withoutGroup", "WithoutGroup"));
            Assert.Equal(1, GetLongFromAnyCase(quickFilterCounts, "trial", "Trial"));

            var clientsPayload = GetArrayPayload(listPayload, "items", "clients");
            var withoutMembershipClient = clientsPayload.EnumerateArray()
                .Single(candidate => GetGuidFromProperty(candidate, "id") == withoutMembershipNoGroupClientId);
            var withoutMembershipHints = GetArrayPayload(
                GetPropertyOrNull(withoutMembershipClient, "actionHints", "ActionHints"));
            Assert.Equal("Оформить абонемент", GetStringFromAnyCase(withoutMembershipHints[0], "title", "Title"));
            Assert.Equal("Нет текущего абонемента", GetStringFromAnyCase(withoutMembershipHints[0], "description", "Description"));
            Assert.Equal("orange", GetStringFromAnyCase(withoutMembershipHints[0], "tone", "Tone"));
            Assert.Equal("Назначить группу", GetStringFromAnyCase(withoutMembershipHints[1], "title", "Title"));

            var unpaidClient = clientsPayload.EnumerateArray()
                .Single(candidate => GetGuidFromProperty(candidate, "id") == unpaidClientId);
            var unpaidHints = GetArrayPayload(
                GetPropertyOrNull(unpaidClient, "actionHints", "ActionHints"));
            Assert.Equal("Проверить оплату", GetStringFromAnyCase(unpaidHints[0], "title", "Title"));
            Assert.Equal("red", GetStringFromAnyCase(unpaidHints[0], "tone", "Tone"));

            var expiredTrialClient = clientsPayload.EnumerateArray()
                .Single(candidate => GetGuidFromProperty(candidate, "id") == expiredTrialClientId);
            var expiredTrialHints = GetArrayPayload(
                GetPropertyOrNull(expiredTrialClient, "actionHints", "ActionHints"));
            Assert.Single(expiredTrialHints.EnumerateArray());
            Assert.Equal("Оформить абонемент", GetStringFromAnyCase(expiredTrialHints[0], "title", "Title"));
        }

        using (var filteredResponse = await client.GetAsync("/clients?status=Active&quickFilters=WithoutMembership,Trial"))
        {
            Assert.Equal(HttpStatusCode.OK, filteredResponse.StatusCode);
            var filteredPayload = await ReadJsonElementAsync(filteredResponse);
            var filteredIds = GetArrayPayload(filteredPayload, "items", "clients")
                .EnumerateArray()
                .Select(candidate => GetGuidFromProperty(candidate, "id"))
                .ToArray();

            Assert.Contains(withoutMembershipNoGroupClientId, filteredIds);
            Assert.Contains(withoutMembershipClientId, filteredIds);
            Assert.Contains(expiredTrialClientId, filteredIds);
            Assert.DoesNotContain(expiringClientId, filteredIds);
            Assert.DoesNotContain(unpaidClientId, filteredIds);
            Assert.DoesNotContain(normalClientId, filteredIds);
            Assert.DoesNotContain(professionalClientId, filteredIds);

            var quickFilterCounts = GetPropertyOrNull(filteredPayload, "quickFilterCounts", "QuickFilterCounts");
            Assert.Equal(2, GetLongFromAnyCase(quickFilterCounts, "withoutMembership", "WithoutMembership"));
            Assert.Equal(1, GetLongFromAnyCase(quickFilterCounts, "trial", "Trial"));
        }

        using (var searchCountsResponse = await client.GetAsync($"/clients?status=Active&query={Uri.EscapeDataString("WithoutMembership")}"))
        {
            Assert.Equal(HttpStatusCode.OK, searchCountsResponse.StatusCode);
            var searchCountsPayload = await ReadJsonElementAsync(searchCountsResponse);
            var quickFilterCounts = GetPropertyOrNull(searchCountsPayload, "quickFilterCounts", "QuickFilterCounts");

            Assert.Equal(2, GetLongFromAnyCase(quickFilterCounts, "withoutMembership", "WithoutMembership"));
            Assert.Equal(0, GetLongFromAnyCase(quickFilterCounts, "expiringSoon", "ExpiringSoon"));
            Assert.Equal(1, GetLongFromAnyCase(quickFilterCounts, "withoutGroup", "WithoutGroup"));
            Assert.Equal(0, GetLongFromAnyCase(quickFilterCounts, "trial", "Trial"));
        }

        using (var professionalDetailsResponse = await client.GetAsync($"/clients/{professionalClientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, professionalDetailsResponse.StatusCode);
            var professionalDetailsPayload = await ReadJsonElementAsync(professionalDetailsResponse);
            var actionHints = GetArrayPayload(
                GetPropertyOrNull(professionalDetailsPayload, "actionHints", "ActionHints"));

            Assert.Equal("Плановое сопровождение", GetStringFromAnyCase(actionHints[0], "title", "Title"));
            Assert.Equal("Льготный клиент", GetStringFromAnyCase(actionHints[0], "description", "Description"));
        }

        using (var invalidQuickFilterResponse = await client.GetAsync("/clients?quickFilters=Unknown"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalidQuickFilterResponse.StatusCode);
            var invalidPayload = await ReadJsonElementAsync(invalidQuickFilterResponse);
            var errors = GetPropertyOrNull(invalidPayload, "errors", "Errors");

            Assert.NotEqual(
                JsonValueKind.Undefined,
                GetPropertyOrNull(errors, "quickFilters", "QuickFilters").ValueKind);
        }
    }

    [Theory]
    [InlineData("HeadCoach")]
    [InlineData("Administrator")]
    public async Task HeadCoach_or_Administrator_can_manage_client_membership_and_client_details_include_membership_fields(
        string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(
            client,
            actorRole == "HeadCoach"
                ? seeded.HeadCoachLogin
                : seeded.AdministratorLogin,
            seeded.SharedPassword);

        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var purchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var renewalDate = purchaseDate.AddMonths(1);
        var correctionDate = purchaseDate.AddMonths(2);

        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                       ExpirationDate = purchaseDate.AddMonths(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1200m,
                       IsPaid = false,
                       SingleVisitUsed = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       RenewalDate = renewalDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1300m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);
        }

        using (var correctResponse = await SendMembershipActionAsync(
                   client,
                   "correct",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = correctionDate.ToString("yyyy-MM-dd"),
                       ExpirationDate = correctionDate.AddYears(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 2000m,
                       IsPaid = false,
                       SingleVisitUsed = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, correctResponse.StatusCode);
        }

        using (var paymentResponse = await SendMembershipActionAsync(
                   client,
                   "mark-payment",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PaymentAmount = 2000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, paymentResponse.StatusCode);
        }

        using var getResponse = await client.GetAsync($"/clients/{clientId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var getPayload = await ReadJsonElementAsync(getResponse);
        var currentMembership = GetPropertyOrNull(
            getPayload,
            "currentMembership",
            "CurrentMembership");
        Assert.False(currentMembership.ValueKind == JsonValueKind.Undefined);
        Assert.Equal("Term", GetStringFromAnyCase(currentMembership, "behaviorKind", "MembershipBehaviorKind"));
        Assert.True(GetBoolFromAnyCase(currentMembership, "isPaid", "IsPaid") == true);

        var historyPayload = GetArrayPayload(
            getPayload,
            "membershipHistory",
            "MembershipHistory",
            "membershipHistoryItems",
            "MembershipHistoryItems");
        Assert.Equal(4, historyPayload.GetArrayLength());

        var membershipIdsFromResponse = historyPayload
            .EnumerateArray()
            .Select(entry => GetGuidFromAnyCase(entry, "id", "Id"))
            .ToArray();
        Assert.Equal(4, membershipIdsFromResponse.Length);
        Assert.All(membershipIdsFromResponse, membershipId => Assert.NotEqual(Guid.Empty, membershipId));

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var memberships = await dbContext.ClientMemberships
            .Where(membership => membership.ClientId == clientId)
            .OrderBy(membership => membership.ValidFrom)
            .ToListAsync();

        Assert.Equal(4, memberships.Count);
        Assert.Equal(2, memberships.Count(membership => membership.ValidTo is null));
        var sales = await dbContext.ClientMembershipSales
            .Where(sale => sale.ClientId == clientId)
            .OrderBy(sale => sale.CreatedAt)
            .ToArrayAsync();
        Assert.Equal(2, sales.Length);
        Assert.Equal(1200m, sales[0].GrossAmount);
        Assert.Equal(purchaseDate, sales[0].PurchaseDate);
        Assert.Equal(1200m, sales[1].GrossAmount);
        Assert.Equal(correctionDate, sales[1].PurchaseDate);
        Assert.Equal(sales[0].Id, memberships.Single(membership => membership.ChangeReason == ClientMembershipChangeReason.NewPurchase).SaleId);
        Assert.All(
            memberships.Where(membership => membership.ChangeReason is ClientMembershipChangeReason.Renewal or ClientMembershipChangeReason.Correction or ClientMembershipChangeReason.PaymentUpdate),
            membership => Assert.Equal(sales[1].Id, membership.SaleId));
        var historyIds = historyPayload
            .EnumerateArray()
            .Select(entry => GetGuidFromAnyCase(entry, "id", "Id"))
            .ToArray();
        var orderedByCreated = memberships.Select(membership => membership.Id);
        var orderedByCreatedReversed = memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .Select(membership => membership.Id);

        Assert.True(
            historyIds.SequenceEqual(orderedByCreated) || historyIds.SequenceEqual(orderedByCreatedReversed),
            "Membership history must be returned in a stable order.");
        Assert.All(membershipIdsFromResponse, id => Assert.Contains(id, memberships.Select(membership => membership.Id)));
    }

    [Fact]
    public async Task Membership_refunds_are_stored_separately_audited_and_excluded_when_canceled()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var purchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using var purchaseResponse = await SendMembershipActionAsync(
            client,
            "purchase",
            clientId,
            new
            {
                BehaviorKind = "Term",
                PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = true
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, purchaseResponse.StatusCode);
        var purchasePayload = await ReadJsonElementAsync(purchaseResponse);
        var saleId = GetGuidFromAnyCase(
            GetPropertyOrNull(purchasePayload, "currentMembership", "CurrentMembership"),
            "saleId",
            "SaleId");
        Assert.NotEqual(Guid.Empty, saleId);

        using var refundResponse = await PostJsonAsync(
            client,
            $"/clients/{clientId}/membership/sales/{saleId}/refunds",
            new
            {
                Amount = 400m,
                RefundDate = purchaseDate.ToString("yyyy-MM-dd"),
                Comment = "Частичный возврат"
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, refundResponse.StatusCode);
        var refundPayload = await ReadJsonElementAsync(refundResponse);
        var currentMembership = GetPropertyOrNull(refundPayload, "currentMembership", "CurrentMembership");
        Assert.Equal(1200m, GetDecimalFromAnyCase(currentMembership, "paymentAmount", "PaymentAmount"));
        Assert.True(GetBoolFromAnyCase(currentMembership, "isPaid", "IsPaid"));

        var summary = GetPropertyOrNull(currentMembership, "financialSummary", "FinancialSummary");
        Assert.Equal(1200m, GetDecimalFromAnyCase(summary, "grossAmount", "GrossAmount"));
        Assert.Equal(400m, GetDecimalFromAnyCase(summary, "refundedAmount", "RefundedAmount"));
        Assert.Equal(800m, GetDecimalFromAnyCase(summary, "netAmount", "NetAmount"));
        Assert.Equal("Partial", GetStringFromAnyCase(summary, "refundStatus", "RefundStatus"));
        Assert.Equal(purchaseDate.ToString("yyyy-MM-dd"), GetStringFromAnyCase(summary, "lastRefundDate", "LastRefundDate"));

        var refunds = GetArrayPayload(GetPropertyOrNull(currentMembership, "refunds", "Refunds"));
        Assert.Single(refunds.EnumerateArray());
        var refundId = GetGuidFromAnyCase(refunds[0], "id", "Id");
        Assert.NotEqual(Guid.Empty, refundId);
        Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(refunds[0], "canceledAt", "CanceledAt").ValueKind);

        using (var cancelResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/refunds/{refundId}/cancel",
                   new { },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
            var cancelPayload = await ReadJsonElementAsync(cancelResponse);
            var canceledMembership = GetPropertyOrNull(cancelPayload, "currentMembership", "CurrentMembership");
            var canceledSummary = GetPropertyOrNull(canceledMembership, "financialSummary", "FinancialSummary");
            Assert.Equal(0m, GetDecimalFromAnyCase(canceledSummary, "refundedAmount", "RefundedAmount"));
            Assert.Equal(1200m, GetDecimalFromAnyCase(canceledSummary, "netAmount", "NetAmount"));
            Assert.Equal("None", GetStringFromAnyCase(canceledSummary, "refundStatus", "RefundStatus"));
            Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(canceledSummary, "lastRefundDate", "LastRefundDate").ValueKind);
        }

        using (var repeatCancelResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/refunds/{refundId}/cancel",
                   new { },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, repeatCancelResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedRefund = await dbContext.ClientMembershipRefunds.SingleAsync(refund => refund.Id == refundId);
        Assert.NotNull(persistedRefund.CanceledAt);
        Assert.Equal(seeded.HeadCoachId, persistedRefund.CanceledByUserId);

        var auditActions = await dbContext.AuditLogs
            .Where(log => log.EntityId == refundId.ToString())
            .Select(log => log.ActionType)
            .ToArrayAsync();
        Assert.Contains("ClientMembershipRefundCreated", auditActions);
        Assert.Contains("ClientMembershipRefundCanceled", auditActions);
    }

    [Fact]
    public async Task Membership_refund_and_correction_validations_protect_sale_semantics()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var purchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-1);
        using var purchaseResponse = await SendMembershipActionAsync(
            client,
            "purchase",
            clientId,
            new
            {
                BehaviorKind = "Term",
                PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = true
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.OK, purchaseResponse.StatusCode);
        var purchasePayload = await ReadJsonElementAsync(purchaseResponse);
        var saleId = GetGuidFromAnyCase(
            GetPropertyOrNull(purchasePayload, "currentMembership", "CurrentMembership"),
            "saleId",
            "SaleId");

        using (var negativeRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = -1m, RefundDate = purchaseDate.ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, negativeRefundResponse.StatusCode);
        }

        using (var futureRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = 1m, RefundDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1).ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, futureRefundResponse.StatusCode);
        }

        using (var beforePurchaseRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = 1m, RefundDate = purchaseDate.AddDays(-1).ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, beforePurchaseRefundResponse.StatusCode);
        }

        using (var beforeSaleCreatedRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = 1m, RefundDate = purchaseDate.ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, beforeSaleCreatedRefundResponse.StatusCode);
        }

        var refundDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var validRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = 700m, RefundDate = refundDate.ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, validRefundResponse.StatusCode);
        }

        using (var excessiveRefundResponse = await PostJsonAsync(
                   client,
                   $"/clients/{clientId}/membership/sales/{saleId}/refunds",
                   new { Amount = 501m, RefundDate = refundDate.ToString("yyyy-MM-dd") },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, excessiveRefundResponse.StatusCode);
        }

        using (var lowCorrectionResponse = await SendMembershipActionAsync(
                   client,
                   "correct",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 600m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, lowCorrectionResponse.StatusCode);
        }

        using (var latePurchaseDateCorrectionResponse = await SendMembershipActionAsync(
                   client,
                   "correct",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = refundDate.AddDays(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, latePurchaseDateCorrectionResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Coach_is_forbidden_from_membership_management_endpoints()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var managerSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            managerSession.CsrfToken,
            seeded.GroupOneId);
        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);

        var payloads = new Dictionary<string, object>
        {
            ["purchase"] = new
            {
                BehaviorKind = "Term",
                PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false,
                SingleVisitUsed = false
            },
            ["renew"] = new
            {
                BehaviorKind = "Term",
                RenewalDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false
            },
            ["correct"] = new
            {
                BehaviorKind = "Term",
                PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                ExpirationDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddMonths(1).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false,
                SingleVisitUsed = false
            },
            ["mark-payment"] = new
            {
                IsPaid = true,
                BehaviorKind = "Term"
            }
        };

        foreach (var kvp in payloads)
        {
            using var response = await SendMembershipActionAsync(
                client,
                kvp.Key,
                clientId,
                kvp.Value,
                actorSession.CsrfToken);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    [Fact]
    public async Task Membership_versioning_keeps_exactly_one_current_and_preserves_history_order()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var now = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = now.ToString("yyyy-MM-dd"),
                       PaymentAmount = 900m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected membership purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       RenewalDate = now.AddMonths(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1100m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);
        }

        using (var correctResponse = await SendMembershipActionAsync(
                   client,
                   "correct",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = now.ToString("yyyy-MM-dd"),
                       ExpirationDate = now.AddMonths(2).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, correctResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var memberships = await dbContext.ClientMemberships
                .Where(membership => membership.ClientId == clientId)
                .OrderBy(membership => membership.ValidFrom)
                .ToListAsync();

            Assert.Equal(3, memberships.Count);
            Assert.Equal(2, memberships.Count(membership => membership.ValidTo is null));
            Assert.True(
                memberships
                    .Where(membership => membership.ValidTo is not null)
                    .All(membership => membership.ValidTo.HasValue));

            using var getResponse = await client.GetAsync($"/clients/{clientId}");
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
            var getPayload = await ReadJsonElementAsync(getResponse);
            var historyPayload = GetArrayPayload(
                getPayload,
                "membershipHistory",
                "MembershipHistory",
                "membershipHistoryItems");
            Assert.Equal(memberships.Count, historyPayload.GetArrayLength());
        }
    }

    [Fact]
    public async Task Membership_purchase_uses_inclusive_default_expiration_date()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var purchaseDate = new DateOnly(2026, 6, 10);
        var expectedExpirationDate = new DateOnly(2026, 7, 9);

        using (var suggestionResponse = await client.GetAsync(
                   $"/clients/membership/expiration-suggestion?behaviorKind=Term&startDate={purchaseDate:yyyy-MM-dd}"))
        {
            Assert.Equal(HttpStatusCode.OK, suggestionResponse.StatusCode);
            var suggestionPayload = await ReadJsonElementAsync(suggestionResponse);
            Assert.Equal("Term", GetStringFromAnyCase(suggestionPayload, "behaviorKind", "MembershipBehaviorKind"));
            Assert.Equal(
                expectedExpirationDate.ToString("yyyy-MM-dd"),
                GetStringFromAnyCase(suggestionPayload, "expirationDate", "ExpirationDate"));
        }

        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1200m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");

            var purchasePayload = await ReadJsonElementAsync(purchaseResponse);
            var currentMembershipPayload = GetPropertyOrNull(purchasePayload, "currentMembership", "CurrentMembership");
            Assert.Equal(
                expectedExpirationDate.ToString("yyyy-MM-dd"),
                GetStringFromAnyCase(currentMembershipPayload, "expirationDate", "ExpirationDate"));
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var currentMembership = await dbContext.ClientMemberships.SingleAsync(
            membership => membership.ClientId == clientId && membership.ValidTo == null);

        Assert.Equal(expectedExpirationDate, currentMembership.IndividualValidTo);
    }

    [Fact]
    public async Task Membership_renewal_uses_previous_expiration_by_default()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var purchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var firstExpirationDate = purchaseDate.AddMonths(1).AddDays(-1);
        var renewalDate = purchaseDate.AddDays(10);

        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = purchaseDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       RenewalDate = renewalDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1000m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var memberships = await dbContext.ClientMemberships
            .Where(membership => membership.ClientId == clientId)
            .OrderBy(membership => membership.ValidTo == null ? 1 : 0)
            .ToListAsync();

        Assert.Equal(2, memberships.Count);
        var current = memberships
            .Where(membership => membership.ValidTo is null)
            .OrderByDescending(membership => membership.IndividualValidTo)
            .First();
        Assert.Equal(firstExpirationDate.AddMonths(1), current.IndividualValidTo);
    }

    [Fact]
    public async Task Membership_renewal_falls_back_to_payment_date_if_expired_more_than_month_without_attendance()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var currentDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var oldExpiration = currentDate.AddMonths(-2);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var validFrom = DateTimeOffset.UtcNow.AddMonths(-2);
            dbContext.ClientMemberships.Add(CreateMembershipWithSale(
                clientId,
                MembershipBehaviorKind.Term,
                currentDate.AddMonths(-3),
                oldExpiration,
                700m,
                isPaid: true,
                seeded.HeadCoachId,
                validFrom,
                paidAt: validFrom));

            await dbContext.SaveChangesAsync();
        }

        var renewalDate = currentDate;
        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       RenewalDate = renewalDate.ToString("yyyy-MM-dd"),
                       PaymentDate = renewalDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 700m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);
        }

        using var historyScope = factory.Services.CreateScope();
        var historyDb = historyScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var memberships = await historyDb.ClientMemberships
            .Where(membership => membership.ClientId == clientId)
            .OrderBy(membership => membership.ValidFrom)
            .ToListAsync();

        Assert.Equal(2, memberships.Count);
        var current = memberships
            .Where(membership => membership.ValidTo is null)
            .OrderByDescending(membership => membership.IndividualValidTo)
            .First();
        Assert.Equal(oldExpiration.AddMonths(1), current.IndividualValidTo);
    }

    [Fact]
    public async Task SingleVisit_membership_resets_single_visit_used_on_purchase_and_correction()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.AdministratorLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var now = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "SingleVisit",
                       PurchaseDate = now.ToString("yyyy-MM-dd"),
                       PaymentAmount = 500m,
                       IsPaid = true,
                       SingleVisitUsed = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var firstCurrent = await dbContext.ClientMemberships
                .Where(membership => membership.ClientId == clientId && membership.ValidTo == null)
                .SingleAsync();
            Assert.False(firstCurrent.SingleVisitUsed);
        }

        using (var correctResponse = await SendMembershipActionAsync(
                   client,
                   "correct",
                   clientId,
                   new
                   {
                       BehaviorKind = "SingleVisit",
                       PurchaseDate = now.ToString("yyyy-MM-dd"),
                       PaymentAmount = 600m,
                       IsPaid = true,
                       SingleVisitUsed = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, correctResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var secondCurrent = await dbContext.ClientMemberships
                .Where(membership => membership.ClientId == clientId && membership.ValidTo == null)
                .SingleAsync();
            Assert.Equal(MembershipBehaviorKind.SingleVisit, secondCurrent.BehaviorKind);
            Assert.False(secondCurrent.SingleVisitUsed);
        }
    }

    [Fact]
    public async Task Mark_payment_records_audit_data_and_creates_new_membership_version()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var payerId = Guid.Parse(actorSession.User?.Id ?? throw new InvalidOperationException("Missing session user id."));
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var membershipDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = membershipDate.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1500m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var paymentResponse = await SendMembershipActionAsync(
                   client,
                   "mark-payment",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PaymentAmount = 1500m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, paymentResponse.StatusCode);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var memberships = await dbContext.ClientMemberships
                .Where(membership => membership.ClientId == clientId)
                .OrderBy(membership => membership.CreatedAt)
                .ToListAsync();

            Assert.Equal(2, memberships.Count);
            var current = memberships.Single(membership => membership.ValidTo is null);
            Assert.True(current.IsPaid);
            Assert.Equal(payerId, current.PaidByUserId);
            Assert.NotNull(current.PaidAt);
            Assert.Equal(membershipDate, DateOnly.FromDateTime(current.PaidAt!.Value.UtcDateTime));
        }
    }

    [Fact]
    public async Task Membership_change_actions_are_written_to_audit_log_without_password_data()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var actorId = Guid.Parse(actorSession.User?.Id ?? throw new InvalidOperationException("Missing session user id."));
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

        var operationStartedAt = DateTimeOffset.UtcNow;
        var now = DateOnly.FromDateTime(DateTime.UtcNow.Date);

        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PurchaseDate = now.ToString("yyyy-MM-dd"),
                       PaymentAmount = 1200m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(
                purchaseResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
                $"Expected purchase success, got {purchaseResponse.StatusCode}.");
        }

        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       RenewalDate = now.AddMonths(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 1300m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, renewResponse.StatusCode);
        }

        using (var markPaymentResponse = await SendMembershipActionAsync(
                   client,
                   "mark-payment",
                   clientId,
                   new
                   {
                       BehaviorKind = "Term",
                       PaymentAmount = 1300m,
                       IsPaid = true
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, markPaymentResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var membershipClientId = clientId.ToString();
        var auditLogs = await dbContext.AuditLogs
            .Where(log => log.UserId == actorId && log.CreatedAt >= operationStartedAt)
            .ToListAsync();

        var membershipRelevantLogs = auditLogs
            .Where(log =>
                log.EntityId == membershipClientId ||
                string.Equals(log.EntityType, "ClientMembership", StringComparison.OrdinalIgnoreCase) ||
                log.ActionType.Contains("membership", StringComparison.OrdinalIgnoreCase) ||
                ContainsMembershipPayload(log.OldValueJson) ||
                ContainsMembershipPayload(log.NewValueJson))
            .ToList();

        Assert.True(membershipRelevantLogs.Any(), "Expected membership-relevant audit logs after actions.");
        foreach (var log in membershipRelevantLogs)
        {
            AssertNoPasswordInAuditState(log.OldValueJson);
            AssertNoPasswordInAuditState(log.NewValueJson);
        }

        var membershipActionLogs = auditLogs
            .Where(log => log.ActionType is "ClientMembershipPurchased" or "ClientMembershipRenewed" or "ClientMembershipPaymentMarked")
            .OrderBy(log => log.CreatedAt)
            .ToList();

        Assert.Equal(
            ["ClientMembershipPurchased", "ClientMembershipRenewed", "ClientMembershipPaymentMarked"],
            membershipActionLogs.Select(log => log.ActionType));
        Assert.All(membershipActionLogs, log => Assert.Equal("ClientMembership", log.EntityType));
        Assert.Equal(
            [
                $"Пользователь '{seeded.HeadCoachLogin}' оформил абонемент клиента 'Membership Client Tests'.",
                $"Пользователь '{seeded.HeadCoachLogin}' продлил абонемент клиента 'Membership Client Tests'.",
                $"Пользователь '{seeded.HeadCoachLogin}' отметил оплату абонемента клиента 'Membership Client Tests'."
            ],
            membershipActionLogs.Select(log => log.Description));
    }

    [Fact]
    public async Task Legacy_professional_status_endpoint_is_not_available()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, session.CsrfToken, seeded.GroupOneId);
        using var response = await PutJsonAsync(client, $"/clients/{clientId}/professional-status",
            new { IsProfessional = true, ProfessionalComment = "legacy" }, session.CsrfToken);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("Administrator")]
    [InlineData("Coach")]
    public async Task Legacy_professional_status_endpoint_is_not_available_for_other_roles(string actorRole)
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var headCoachSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(client, headCoachSession.CsrfToken, seeded.GroupOneId);
        var actorLogin = actorRole == "Administrator"
            ? seeded.AdministratorLogin
            : seeded.CoachLogin;
        var actorSession = await LoginAsync(client, actorLogin, seeded.SharedPassword);

        using var response = await PutJsonAsync(
            client,
            $"/clients/{clientId}/professional-status",
            new
            {
                IsProfessional = true,
                ProfessionalComment = "Недостаточно прав"
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var hasProfessionalMembership = await dbContext.ClientMemberships.AnyAsync(candidate =>
            candidate.ClientId == clientId &&
            candidate.BehaviorKind == MembershipBehaviorKind.Professional &&
            candidate.ValidTo == null);
        Assert.False(hasProfessionalMembership);
    }

    [Fact]
    public async Task Client_create_validates_required_fields_contact_limit_and_groups()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "",
                FirstName = "",
                MiddleName = "",
                Phone = "",
                BranchId = seeded.BranchId,
                Notes = new string('N', Client.NotesMaxLength + 1),
                Contacts = new object[]
                {
                    new
                    {
                        Type = "",
                        FullName = "",
                        Phone = ""
                    },
                    new
                    {
                        Type = "Папа",
                        FullName = "Иванов Петр",
                        Phone = "+79990001201"
                    },
                    new
                    {
                        Type = "Опекун",
                        FullName = "Сидоров Сергей",
                        Phone = "+79990001202"
                    }
                },
                GroupIds = new[] { Guid.NewGuid() }
            },
            actorSession.CsrfToken);

        Assert.Equal(HttpStatusCode.BadRequest, createResponse.StatusCode);

        var validationPayload = await ReadJsonElementAsync(createResponse);
        var errorsPayload = validationPayload.GetProperty("errors");

        Assert.True(errorsPayload.TryGetProperty("phone", out _));
        Assert.True(errorsPayload.TryGetProperty("notes", out _));
        Assert.True(errorsPayload.TryGetProperty("fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].type", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].phone", out _));
        Assert.True(errorsPayload.TryGetProperty("groupIds", out _));
    }

    [Fact]
    public async Task Client_create_requires_branch_and_rejects_group_from_another_branch()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var missingBranchResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       LastName = "No",
                       FirstName = "Branch",
                       Phone = "+79990003331",
                       Contacts = Array.Empty<object>(),
                       GroupIds = Array.Empty<Guid>()
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, missingBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(missingBranchResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("branchId", out _));
        }

        Guid foreignGroupId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var now = DateTimeOffset.UtcNow;
            var foreignBranch = new Branch
            {
                Id = Guid.NewGuid(),
                Name = "Foreign Branch",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignHall = new Hall
            {
                Id = Guid.NewGuid(),
                BranchId = foreignBranch.Id,
                Name = "Foreign Hall",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignGroupType = new GroupType
            {
                Id = Guid.NewGuid(),
                Name = "Foreign Group Type",
                CreatedAt = now,
                UpdatedAt = now
            };
            var foreignGroup = new TrainingGroup
            {
                Id = Guid.NewGuid(),
                BranchId = foreignBranch.Id,
                HallId = foreignHall.Id,
                GroupTypeId = foreignGroupType.Id,
                Name = "Foreign Group",
                TrainingStartTime = new TimeOnly(11, 0),
                DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Branches.Add(foreignBranch);
            dbContext.Halls.Add(foreignHall);
            dbContext.GroupTypes.Add(foreignGroupType);
            dbContext.TrainingGroups.Add(foreignGroup);
            await dbContext.SaveChangesAsync();
            foreignGroupId = foreignGroup.Id;
        }

        using (var crossBranchResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       LastName = "Cross",
                       FirstName = "Branch",
                       Phone = "+79990003332",
                       BranchId = seeded.BranchId,
                       Contacts = Array.Empty<object>(),
                       GroupIds = new[] { foreignGroupId }
                   },
                   session.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.BadRequest, crossBranchResponse.StatusCode);
            var payload = await ReadJsonElementAsync(crossBranchResponse);
            Assert.True(payload.GetProperty("errors").TryGetProperty("groupIds", out _));
        }
    }

    [Fact]
    public async Task Client_notes_are_normalized_to_null_when_request_contains_only_whitespace()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var actorSession = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);

        Guid clientId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       LastName = "Нормализация",
                       FirstName = "Заметок",
                       Phone = "+79990001888",
                       BranchId = seeded.BranchId,
                       Notes = "Есть текст",
                       Contacts = Array.Empty<object>(),
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.True(createResponse.IsSuccessStatusCode);
            var createPayload = await ReadJsonElementAsync(createResponse);
            clientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);
            Assert.Equal("Есть текст", GetStringFromProperty(createPayload, "notes"));
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{clientId}",
                   new
                   {
                       LastName = "Нормализация",
                       FirstName = "Заметок",
                       Phone = "+79990001888",
                       BranchId = seeded.BranchId,
                       Notes = "   \t  ",
                       Contacts = Array.Empty<object>(),
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updatePayload = await ReadJsonElementAsync(updateResponse);
            Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(updatePayload, "notes").ValueKind);
        }

        using (var reloadResponse = await client.GetAsync($"/clients/{clientId}"))
        {
            Assert.Equal(HttpStatusCode.OK, reloadResponse.StatusCode);
            var reloadPayload = await ReadJsonElementAsync(reloadResponse);
            Assert.Equal(JsonValueKind.Null, GetPropertyOrNull(reloadPayload, "notes").ValueKind);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var persistedClient = await dbContext.Clients.SingleAsync(candidate => candidate.Id == clientId);
        Assert.Null(persistedClient.Notes);
    }

    [Fact]
    public async Task Client_audit_entries_are_append_only_and_no_sensitive_data()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });

        var session = await LoginAsync(client, seeded.HeadCoachLogin, seeded.SharedPassword);
        var operationStartedAt = DateTimeOffset.UtcNow;

        Guid createdClientId;
        using (var createResponse = await PostJsonAsync(
                   client,
                   "/clients",
                   new
                   {
                       LastName = "Audit",
                       FirstName = "Client",
                       Phone = "+79990001300",
                       BranchId = seeded.BranchId,
                       Notes = "Первая audit заметка",
                       Contacts = Array.Empty<object>(),
                       GroupIds = new[] { seeded.GroupOneId }
                   },
                   session.CsrfToken))
        {
            Assert.True(createResponse.IsSuccessStatusCode);
            var createPayload = await ReadJsonElementAsync(createResponse);
            createdClientId = await ExtractClientIdFromResponseAsync(createResponse, createPayload);
        }

        using (var updateResponse = await PutJsonAsync(
                   client,
                   $"/clients/{createdClientId}",
                   new
                   {
                       LastName = "Audit",
                       FirstName = "Updated",
                       MiddleName = "Client",
                       Phone = "+79990001301",
                       BranchId = seeded.BranchId,
                       Notes = "Обновленная audit заметка",
                       Contacts = new[]
                       {
                           new
                           {
                               Type = "Мама",
                               FullName = "Аудит Мария",
                               Phone = "+79990001302"
                           }
                       },
                       GroupIds = new[] { seeded.GroupTwoId }
                   },
                   session.CsrfToken))
        {
            Assert.True(updateResponse.IsSuccessStatusCode);
        }

        using (var archiveResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{createdClientId}/archive",
                   session.CsrfToken))
        {
            Assert.True(archiveResponse.IsSuccessStatusCode);
        }

        using (var restoreResponse = await PutWithoutBodyAsync(
                   client,
                   $"/clients/{createdClientId}/restore",
                   session.CsrfToken))
        {
            Assert.True(restoreResponse.IsSuccessStatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var auditLogs = await dbContext.AuditLogs
            .Where(log => log.UserId == seeded.HeadCoachId && log.CreatedAt >= operationStartedAt)
            .OrderBy(log => log.CreatedAt)
            .ToListAsync();

        var clientAuditLogs = auditLogs
            .Where(log => log.EntityId == createdClientId.ToString())
            .OrderBy(log => log.CreatedAt)
            .ToList();

        Assert.Equal(
            ["ClientCreated", "ClientNoteChanged", "ClientUpdated", "ClientNoteChanged", "ClientArchived", "ClientRestored"],
            clientAuditLogs.Select(log => log.ActionType));
        Assert.All(clientAuditLogs, log => Assert.Equal("Client", log.EntityType));
        Assert.Equal(
            [
                $"Пользователь '{seeded.HeadCoachLogin}' создал клиента 'Audit Client'.",
                $"Пользователь '{seeded.HeadCoachLogin}' изменил рабочую заметку клиента 'Audit Client'.",
                $"Пользователь '{seeded.HeadCoachLogin}' изменил клиента 'Audit Updated Client'.",
                $"Пользователь '{seeded.HeadCoachLogin}' изменил рабочую заметку клиента 'Audit Updated Client'.",
                $"Пользователь '{seeded.HeadCoachLogin}' архивировал клиента 'Audit Updated Client'.",
                $"Пользователь '{seeded.HeadCoachLogin}' восстановил клиента 'Audit Updated Client'."
            ],
            clientAuditLogs.Select(log => log.Description));

        var createdAuditLog = clientAuditLogs.Single(log => log.ActionType == "ClientCreated");
        AssertAuditPayloadNotes(createdAuditLog.NewValueJson, "Первая audit заметка");

        var updatedAuditLog = clientAuditLogs.Single(log => log.ActionType == "ClientUpdated");
        AssertAuditPayloadNotes(updatedAuditLog.OldValueJson, "Первая audit заметка");
        AssertAuditPayloadNotes(updatedAuditLog.NewValueJson, "Обновленная audit заметка");

        var noteAuditLogs = clientAuditLogs.Where(log => log.ActionType == "ClientNoteChanged").ToArray();
        Assert.Equal(2, noteAuditLogs.Length);
        Assert.Equal("set", JsonDocument.Parse(noteAuditLogs[0].NewValueJson!).RootElement.GetProperty("transition").GetString());
        Assert.Equal("changed", JsonDocument.Parse(noteAuditLogs[1].NewValueJson!).RootElement.GetProperty("transition").GetString());
        Assert.All(noteAuditLogs, log =>
        {
            Assert.DoesNotContain("заметка", log.NewValueJson!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(seeded.HeadCoachLogin, log.NewValueJson!, StringComparison.OrdinalIgnoreCase);
        });

        foreach (var log in auditLogs)
        {
            AssertNoPasswordInAuditState(log.OldValueJson);
            AssertNoPasswordInAuditState(log.NewValueJson);
        }
    }

    [Fact]
    public async Task Attention_unifies_reasons_and_contacted_is_idempotent_and_audited()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        var clientId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.Clients.Add(new Client
            {
                Id = clientId,
                BranchId = seeded.BranchId,
                LastName = "Внимание",
                FirstName = "Клиент",
                Phone = "+79991234567",
                Notes = "Позвонить после обеда",
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            db.ClientMemberships.Add(CreateMembershipWithSale(
                clientId,
                MembershipBehaviorKind.Term,
                today.AddMonths(-1),
                today.AddDays(3),
                1200m,
                false,
                seeded.HeadCoachId,
                DateTimeOffset.UtcNow));
            for (var offset = 3; offset >= 1; offset--)
            {
                SeedAttendanceEntryForClient(db, clientId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(-offset), false);
            }

            await db.SaveChangesAsync();
        }

        using var http = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var session = await LoginAsync(http, seeded.HeadCoachLogin, seeded.SharedPassword);
        using (var response = await http.GetAsync("/clients/attention"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var payload = await ReadJsonElementAsync(response);
            var card = Assert.Single(payload.EnumerateArray(), item => item.GetProperty("clientId").GetGuid() == clientId);
            var reasonTypes = card.GetProperty("reasons").EnumerateArray()
                .Select(reason => reason.GetProperty("type").GetString())
                .ToArray();
            Assert.Contains("missedTraining", reasonTypes);
            Assert.Contains("expiringMembership", reasonTypes);
            Assert.Contains("unpaidMembership", reasonTypes);
            Assert.Equal(3, card.GetProperty("reasons").EnumerateArray()
                .Single(reason => reason.GetProperty("type").GetString() == "missedTraining")
                .GetProperty("missedCount").GetInt32());
        }

        for (var attempt = 0; attempt < 2; attempt++)
        {
            using var response = await PostJsonAsync(
                http,
                $"/clients/{clientId}/attention/missed-training/contacted",
                new { },
                session.CsrfToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var card = await ReadJsonElementAsync(response);
            Assert.DoesNotContain(
                card.GetProperty("reasons").EnumerateArray(),
                reason => reason.GetProperty("type").GetString() == "missedTraining");
        }

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        Assert.Equal(1, await verifyDb.ClientMissedTrainingAcknowledgements.CountAsync(item => item.ClientId == clientId));
        Assert.Equal(1, await verifyDb.AuditLogs.CountAsync(item => item.ActionType == "ClientMissedTrainingContacted"));
    }

    [Fact]
    public async Task Attention_is_forbidden_for_coach_and_legacy_membership_endpoint_remains_available()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        using var http = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        await LoginAsync(http, seeded.CoachLogin, seeded.SharedPassword);
        using (var forbidden = await http.GetAsync("/clients/attention"))
        {
            Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        }

        await LoginAsync(http, seeded.HeadCoachLogin, seeded.SharedPassword);
        using var legacy = await http.GetAsync("/clients/expiring-memberships");
        Assert.Equal(HttpStatusCode.OK, legacy.StatusCode);
    }

    [Fact]
    public void Invalid_attention_window_fails_application_startup()
    {
        using var factory = new ClientsAppFactory(new Dictionary<string, string?>
        {
            ["ClientAttention:MembershipWindowDays"] = "-1"
        });

        Assert.ThrowsAny<Exception>(() => factory.CreateClient());
    }

    [Fact]
    public async Task Attention_honors_window_override_branch_scope_telegram_and_ordering()
    {
        await using var factory = new ClientsAppFactory(new Dictionary<string, string?>
        {
            ["ClientAttention:MembershipWindowDays"] = "1"
        });
        var seeded = await SeedClientsDataAsync(factory);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var visibleMissedId = Guid.NewGuid();
        var visibleMembershipId = Guid.NewGuid();
        var outsideId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var outsideBranch = new Branch
            {
                Id = Guid.NewGuid(), Name = "Outside", Address = "Outside", IsArchived = false,
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Branches.Add(outsideBranch);
            db.Clients.AddRange(
                NewAttentionClient(visibleMissedId, seeded.BranchId, "Альфа"),
                NewAttentionClient(visibleMembershipId, seeded.BranchId, "Бета"),
                NewAttentionClient(outsideId, outsideBranch.Id, "Чужой"));
            db.ClientMemberships.AddRange(
                CreateMembershipWithSale(visibleMembershipId, MembershipBehaviorKind.Term, today, today.AddDays(1), 1000m, true, seeded.HeadCoachId, DateTimeOffset.UtcNow),
                CreateMembershipWithSale(outsideId, MembershipBehaviorKind.Term, today, today.AddDays(1), 1000m, false, seeded.HeadCoachId, DateTimeOffset.UtcNow));
            for (var offset = 3; offset >= 1; offset--)
            {
                SeedAttendanceEntryForClient(db, visibleMissedId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(-offset), false);
            }
            db.ClientMessengerAccounts.AddRange(
                NewTelegramAccount(visibleMissedId, "valid_user"),
                NewTelegramAccount(visibleMembershipId, "bad name"));
            await db.SaveChangesAsync();
        }

        using var http = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var admin = await LoginAsync(http, seeded.AdministratorLogin, seeded.SharedPassword);
        using (var response = await http.GetAsync("/clients/attention"))
        {
            var cards = (await ReadJsonElementAsync(response)).EnumerateArray().ToArray();
            Assert.Equal([visibleMissedId, visibleMembershipId], cards.Select(card => card.GetProperty("clientId").GetGuid()));
            Assert.Equal("https://t.me/valid_user", cards[0].GetProperty("telegramLink").GetString());
            Assert.Equal(JsonValueKind.Null, cards[1].GetProperty("telegramLink").ValueKind);
            Assert.DoesNotContain(cards, card => card.GetProperty("clientId").GetGuid() == outsideId);
        }
        using var outsideAction = await PostJsonAsync(http, $"/clients/{outsideId}/attention/missed-training/contacted", new { }, admin.CsrfToken);
        Assert.Equal(HttpStatusCode.NotFound, outsideAction.StatusCode);
    }

    [Fact]
    public async Task Missed_reason_returns_after_three_new_absences_after_contacted_boundary()
    {
        await using var factory = new ClientsAppFactory();
        var seeded = await SeedClientsDataAsync(factory);
        var clientId = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            db.Clients.Add(NewAttentionClient(clientId, seeded.BranchId, "Повторный"));
            for (var offset = 3; offset >= 1; offset--)
                SeedAttendanceEntryForClient(db, clientId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(-offset), false);
            await db.SaveChangesAsync();
        }
        using var http = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var session = await LoginAsync(http, seeded.HeadCoachLogin, seeded.SharedPassword);
        using (var contacted = await PostJsonAsync(http, $"/clients/{clientId}/attention/missed-training/contacted", new { }, session.CsrfToken))
            Assert.Equal(HttpStatusCode.NoContent, contacted.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            for (var offset = 0; offset < 3; offset++)
                SeedAttendanceEntryForClient(db, clientId, seeded.GroupOneId, seeded.HeadCoachId, today.AddDays(offset), false);
            await db.SaveChangesAsync();
        }
        using var response = await http.GetAsync("/clients/attention");
        var card = Assert.Single((await ReadJsonElementAsync(response)).EnumerateArray(), item => item.GetProperty("clientId").GetGuid() == clientId);
        Assert.Equal(3, card.GetProperty("reasons")[0].GetProperty("missedCount").GetInt32());
    }

    private static Client NewAttentionClient(Guid id, Guid branchId, string lastName) => new()
    {
        Id = id, BranchId = branchId, LastName = lastName, FirstName = "Клиент", Phone = "+79990000000",
        Status = ClientStatus.Active, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
    };

    private static ClientMessengerAccount NewTelegramAccount(Guid clientId, string username) => new()
    {
        Id = Guid.NewGuid(), ClientId = clientId, Platform = MessengerPlatform.Telegram,
        PlatformUserId = Guid.NewGuid().ToString("N"), PlatformUserIdHash = Guid.NewGuid().ToString("N"),
        Username = username, LinkedAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
    };

    private static async Task<SeededClientsData> SeedClientsDataAsync(ClientsAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();

        var now = DateTimeOffset.UtcNow;
        var sharedPassword = "stage6a-password";

        var headCoach = CreateUser("headcoach-stage6a", "Главный тренер Stage 6a", UserRole.HeadCoach, sharedPassword, now, passwordHashService);
        var administrator = CreateUser("administrator-stage6a", "Администратор Stage 6a", UserRole.Administrator, sharedPassword, now, passwordHashService);
        var coach = CreateUser("coach-stage6a", "Тренер Stage 6a", UserRole.Coach, sharedPassword, now, passwordHashService);

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Main Branch",
            Address = "Main address",
            Description = "Primary test branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        administrator.BranchId = branch.Id;

        var hallOne = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Hall One",
            Description = "First test hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var hallTwo = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Hall Two",
            Description = "Second test hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Clients Default Type",
            CreatedAt = now,
            UpdatedAt = now
        };

        var groupOne = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hallOne.Id,
            GroupTypeId = groupType.Id,
            Name = "Group One",
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
            Name = "Group Two",
            TrainingStartTime = new TimeOnly(18, 30),
            DurationMinutes = 60,
                Weekdays = new[] { 1, 3 },
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var archivedClient = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Архивный",
            FirstName = "Клиент",
            Phone = "+79990001000",
            Status = ClientStatus.Archived,
            CreatedAt = now,
            UpdatedAt = now
        };

        var availableFrom = DateOnly.FromDateTime(now.UtcDateTime.Date).AddYears(-1);
        var termCatalogItem = MembershipCatalogItem.CreateBranchOwned(
            branch.Id, "Тестовый срочный", 1200m, MembershipBehaviorKind.Term, availableFrom, null, now);
        var singleVisitCatalogItem = MembershipCatalogItem.CreateBranchOwned(
            branch.Id, "Тестовый разовый", 500m, MembershipBehaviorKind.SingleVisit, availableFrom, null, now);
        var professionalCatalogItem = MembershipCatalogItem.CreateProfessional(
            "Тестовый профессиональный", availableFrom, null, now);
        termCatalogItem.Id = TermCatalogItemId;
        singleVisitCatalogItem.Id = SingleVisitCatalogItemId;
        professionalCatalogItem.Id = ProfessionalCatalogItemId;

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.Branches.Add(branch);
        dbContext.Halls.AddRange(hallOne, hallTwo);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.AddRange(groupOne, groupTwo);
        dbContext.Clients.Add(archivedClient);
        dbContext.MembershipCatalogItems.AddRange(termCatalogItem, singleVisitCatalogItem, professionalCatalogItem);
        await dbContext.SaveChangesAsync();

        return new SeededClientsData(
            headCoach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Id,
            coach.Login,
            sharedPassword,
            branch.Id,
            hallOne.Id,
            hallTwo.Id,
            groupOne.Id,
            groupTwo.Id,
            archivedClient.Id);
    }

    private static void SeedAttendanceEntryForClient(
        GymCrmDbContext dbContext,
        Guid clientId,
        Guid groupId,
        Guid markedByUserId,
        DateOnly trainingDate,
        bool isPresent)
    {
        var now = DateTimeOffset.UtcNow;
        dbContext.Attendance.Add(new Attendance
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            GroupId = groupId,
            TrainingDate = trainingDate,
            IsPresent = isPresent,
            MarkedByUserId = markedByUserId,
            MarkedAt = now,
            UpdatedAt = now
        });
    }

    private static IReadOnlyList<JsonElement> GetArrayPayloadOrEmpty(JsonElement payload, params string[] alternativeNames)
    {
        var arrayPayload = GetArrayPayload(payload, alternativeNames);
        return arrayPayload.ValueKind == JsonValueKind.Array
            ? arrayPayload.EnumerateArray().ToArray()
            : Array.Empty<JsonElement>();
    }

    private static bool HasAnyProperty(JsonElement payload, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (GetPropertyOrNull(payload, propertyName).ValueKind != JsonValueKind.Undefined)
            {
                return true;
            }
        }

        return false;
    }

    private static decimal GetDecimalFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetDecimal(out var paymentAmount) => paymentAmount,
            JsonValueKind.String when decimal.TryParse(value.GetString(), out var parsedPaymentAmount) => parsedPaymentAmount,
            _ => 0m
        };
    }

    private static Guid? TryGetAttendanceGroupId(JsonElement payload)
    {
        var direct = GetGuidFromAnyCase(payload, "groupId", "GroupId", "trainingGroupId", "TrainingGroupId");
        if (direct != Guid.Empty)
        {
            return direct;
        }

        var groupPayload = GetPropertyOrNull(payload, "group", "Group", "attendanceGroup", "trainingGroup");
        if (groupPayload.ValueKind == JsonValueKind.Object)
        {
            var nested = GetGuidFromAnyCase(
                groupPayload,
                "id",
                "Id",
                "groupId",
                "GroupId",
                "trainingGroupId",
                "TrainingGroupId");
            if (nested != Guid.Empty)
            {
                return nested;
            }
        }

        return null;
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

    private static async Task<HttpResponseMessage> PutWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostPhotoAsync(
        HttpClient client,
        Guid clientId,
        byte[] content,
        string fileName,
        string contentType,
        string csrfToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{clientId}/photo");
        var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(content);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        multipart.Add(fileContent, "photo", fileName);
        request.Content = multipart;
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

    private static async Task<Guid> ExtractClientIdFromResponseAsync(
        HttpResponseMessage response,
        JsonElement responsePayload)
    {
        if (TryGetGuid(responsePayload, "Id", out var clientId))
        {
            return clientId;
        }

        if (TryGetGuid(responsePayload, "id", out clientId))
        {
            return clientId;
        }

        if (response.Headers.Location is { } location &&
            Guid.TryParse(location.Segments.LastOrDefault(), out var idFromLocation))
        {
            return idFromLocation;
        }

        Assert.Fail("Client id not present in create response.");
        return Guid.Empty;
    }

    private static async Task<Guid> CreateClientForMembershipTestsAsync(
        HttpClient client,
        string csrfToken,
        Guid groupId)
    {
        var branchId = await ResolveGroupBranchIdAsync(client, groupId);
        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "Membership",
                FirstName = "Client",
                MiddleName = "Tests",
                Phone = $"+7999000{Guid.NewGuid():N}".Substring(0, 11),
                BranchId = branchId,
                Contacts = Array.Empty<object>(),
                GroupIds = new[] { groupId }
            },
            csrfToken);

        Assert.True(
            createResponse.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created,
            $"Expected client create success, got {createResponse.StatusCode}.");

        var createPayload = await ReadJsonElementAsync(createResponse);
        return await ExtractClientIdFromResponseAsync(createResponse, createPayload);
    }

    private static async Task<Guid> ResolveGroupBranchIdAsync(HttpClient client, Guid groupId)
    {
        using var groupResponse = await client.GetAsync($"/groups/{groupId}");
        Assert.Equal(HttpStatusCode.OK, groupResponse.StatusCode);

        var groupPayload = await ReadJsonElementAsync(groupResponse);
        var branchId = GetGuidFromAnyCase(groupPayload, "branchId", "BranchId");
        Assert.NotEqual(Guid.Empty, branchId);
        return branchId;
    }

    private static async Task<HttpResponseMessage> SendMembershipActionAsync(
        HttpClient client,
        string action,
        Guid clientId,
        object payload,
        string csrfToken)
    {
        if (!MembershipActionPathTemplates.TryGetValue(action, out var candidatePaths))
        {
            throw new ArgumentException($"Unknown membership action '{action}'.", nameof(action));
        }

        payload = await NormalizeMembershipActionPayloadAsync(client, action, clientId, payload);

        HttpResponseMessage response;
        foreach (var template in candidatePaths)
        {
            var path = string.Format(template, clientId);
            response = await PostJsonAsync(client, path, payload, csrfToken);
            if (response.StatusCode is not HttpStatusCode.NotFound and not HttpStatusCode.MethodNotAllowed)
            {
                return response;
            }

            response.Dispose();
        }

        var fallbackPayload = AddMembershipAction(payload, action);
        response = await PostJsonAsync(
            client,
            $"/clients/{clientId}/membership",
            fallbackPayload,
            csrfToken);
        return response;
    }

    private static async Task<object> NormalizeMembershipActionPayloadAsync(
        HttpClient client, string action, Guid clientId, object payload)
    {
        if (action is not ("purchase" or "renew")) return payload;

        var legacy = JsonSerializer.SerializeToElement(payload);
        using var clientResponse = await client.GetAsync($"/clients/{clientId}");
        if (!clientResponse.IsSuccessStatusCode)
        {
            return payload;
        }
        var clientPayload = await ReadJsonElementAsync(clientResponse);
        var branchId = GetGuidFromAnyCase(clientPayload, "branchId", "BranchId");
        using var catalogResponse = await client.GetAsync($"/membership-catalog/eligible?branchId={branchId}");
        if (!catalogResponse.IsSuccessStatusCode)
        {
            return payload;
        }

        var catalog = await ReadJsonElementAsync(catalogResponse);
        catalog = GetArrayPayload(catalog, "items", "data");
        if (catalog.ValueKind != JsonValueKind.Array)
        {
            return payload;
        }

        var behavior = GetStringFromAnyCase(
            legacy,
            "behaviorKind",
            "BehaviorKind",
            "membershipType",
            "MembershipType");
        if (string.IsNullOrWhiteSpace(behavior)) behavior = "Term";
        var item = catalog.EnumerateArray().FirstOrDefault(candidate => string.Equals(
            GetStringFromAnyCase(candidate, "behaviorKind", "BehaviorKind"), behavior,
            StringComparison.OrdinalIgnoreCase));
        if (item.ValueKind == JsonValueKind.Undefined)
        {
            return payload;
        }
        var catalogItemId = GetGuidFromAnyCase(item, "id", "Id");
        var isPaid = GetBoolFromAnyCase(legacy, "isPaid", "IsPaid") ?? false;
        var paymentDate = isPaid ? DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd") : null;

        if (action == "renew")
            return new { MembershipCatalogItemId = catalogItemId, PaymentStatus = isPaid ? "Paid" : "Unpaid", PaymentDate = paymentDate };

        var validFrom = GetStringFromAnyCase(legacy, "validFrom", "ValidFrom", "purchaseDate", "PurchaseDate");
        var validTo = GetStringFromAnyCase(legacy, "validTo", "ValidTo", "expirationDate", "ExpirationDate");
        if (string.Equals(behavior, nameof(MembershipBehaviorKind.Term), StringComparison.OrdinalIgnoreCase))
        {
            var parsedValidFrom = DateOnly.TryParse(validFrom, out var requestedValidFrom)
                ? requestedValidFrom
                : DateOnly.FromDateTime(DateTime.UtcNow.Date);
            validFrom = parsedValidFrom.ToString("yyyy-MM-dd");
            if (string.IsNullOrWhiteSpace(validTo))
            {
                validTo = parsedValidFrom.AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd");
            }
        }
        else if (string.Equals(behavior, nameof(MembershipBehaviorKind.Professional), StringComparison.OrdinalIgnoreCase))
        {
            validFrom = DateOnly.TryParse(validFrom, out var requestedValidFrom)
                ? requestedValidFrom.ToString("yyyy-MM-dd")
                : DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd");
            validTo = string.Empty;
        }
        else
        {
            validFrom = string.Empty;
            validTo = string.Empty;
        }

        return new
        {
            MembershipCatalogItemId = catalogItemId,
            ValidFrom = string.IsNullOrWhiteSpace(validFrom) ? null : validFrom,
            ValidTo = string.IsNullOrWhiteSpace(validTo) ? null : validTo,
            PaymentStatus = isPaid ? "Paid" : "Unpaid",
            PaymentDate = paymentDate,
            ProfessionalComment = GetStringFromAnyCase(legacy, "professionalComment", "ProfessionalComment")
        };
    }

    private static object AddMembershipAction(object payload, string action)
    {
        var node = JsonSerializer.SerializeToNode(payload)?.AsObject() ?? new JsonObject();
        node["action"] = action;
        return node;
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

    private static string? GetStringFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        if (value.ValueKind == JsonValueKind.String)
        {
            return value.GetString();
        }

        return null;
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

    private static long GetLongFromAnyCase(JsonElement payload, params string[] propertyNames)
    {
        var value = GetPropertyOrNull(payload, propertyNames);
        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt64(out var parsedValue) => parsedValue,
            JsonValueKind.String when long.TryParse(value.GetString(), out var parsedValue) => parsedValue,
            _ => 0
        };
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

    private static bool ContainsMembershipPayload(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(payload);
            return ContainsMembershipPayload(document.RootElement);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool ContainsMembershipPayload(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name.Equals("behaviorKind", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Equals("expirationDate", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Equals("paymentAmount", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Equals("isPaid", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Equals("singleVisitUsed", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (ContainsMembershipPayload(property.Value))
                {
                    return true;
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (ContainsMembershipPayload(item))
                {
                    return true;
                }
            }
        }

        return false;
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

    private static byte[] CreateSamplePngBytes()
    {
        return Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2p6QAAAABJRU5ErkJggg==");
    }

    private static byte[] CreateSampleHeicBytes()
    {
        return CreateHeifContainerBytes("heic");
    }

    private static byte[] CreateSampleHeifBytes()
    {
        return CreateHeifContainerBytes("heif");
    }

    private static byte[] CreateHeifContainerBytes(string brand)
    {
        var bytes = new byte[32];
        bytes[4] = (byte)'f';
        bytes[5] = (byte)'t';
        bytes[6] = (byte)'y';
        bytes[7] = (byte)'p';

        var brandBytes = System.Text.Encoding.ASCII.GetBytes(brand);
        Array.Copy(brandBytes, 0, bytes, 8, brandBytes.Length);

        return bytes;
    }

    private static string ResolveStoredPhotoAbsolutePath(ClientsAppFactory factory, string relativePath)
    {
        return Path.Combine(
            factory.PhotoStorageRootPath,
            relativePath.Replace('/', Path.DirectorySeparatorChar));
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

    private static void AssertAuditPayloadNotes(string? payload, string? expectedNotes)
    {
        Assert.NotNull(payload);

        using var document = JsonDocument.Parse(payload!);
        var notes = GetPropertyOrNull(document.RootElement, "notes", "Notes");

        if (expectedNotes is null)
        {
            Assert.Equal(JsonValueKind.Null, notes.ValueKind);
            return;
        }

        Assert.Equal(JsonValueKind.String, notes.ValueKind);
        Assert.Equal(expectedNotes, notes.GetString());
    }

    private static void AssertProfessionalAuditPayload(
        string? payload,
        bool expectedIsProfessional,
        string? expectedComment)
    {
        Assert.NotNull(payload);

        using var document = JsonDocument.Parse(payload!);
        Assert.Equal(
            (bool?)expectedIsProfessional,
            GetBoolFromAnyCase(document.RootElement, "isProfessional", "IsProfessional"));
        var comment = GetPropertyOrNull(document.RootElement, "professionalComment", "ProfessionalComment");

        if (expectedComment is null)
        {
            Assert.True(comment.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined);
            return;
        }

        Assert.Equal(JsonValueKind.String, comment.ValueKind);
        Assert.Equal(expectedComment, comment.GetString());
    }

    private static void AssertNoPasswordInAuditState(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return;
        }

        Assert.False(ContainsPasswordFieldInJson(payload), "Audit log payload contains password fields.");
    }

    private static Func<IServiceProvider, object?>? CreateTestClientPhotoImageProcessor(IServiceProvider _)
    {
        var processorInterface = Type.GetType(
            "GymCrm.Infrastructure.Clients.IClientPhotoImageProcessor, GymCrm.Infrastructure");
        var resultType = Type.GetType(
            "GymCrm.Infrastructure.Clients.ClientPhotoImageProcessingResult, GymCrm.Infrastructure");
        if (processorInterface is null || resultType is null)
        {
            return null;
        }

        var successFactory = resultType.GetMethod(
            "Success",
            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static,
            null,
            [typeof(byte[]), typeof(string), typeof(string)],
            null);

        if (successFactory is null)
        {
            return null;
        }

        var conversionResult = successFactory.Invoke(
            null,
            [new byte[] { 0xFF, 0xD8, 0xFF, 0xD9 }, "image/jpeg", "jpg"]);
        if (conversionResult is null)
        {
            return null;
        }

        var createProxyMethod = typeof(DispatchProxy)
            .GetMethods()
            .Single(method => method.Name == "Create" && method.IsGenericMethodDefinition);
        var proxy = createProxyMethod
            .MakeGenericMethod(processorInterface, typeof(TestClientPhotoImageProcessorProxy))
            .Invoke(null, null);

        if (proxy is null)
        {
            return null;
        }

        var conversionResultProperty = proxy.GetType().GetProperty(
            nameof(TestClientPhotoImageProcessorProxy.ConversionResult));
        conversionResultProperty?.SetValue(proxy, conversionResult);

        return _ => proxy;
    }

    private static ClientMembership CreateMembershipWithSale(
        Guid clientId,
        MembershipBehaviorKind behaviorKind,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool isPaid,
        Guid changedByUserId,
        DateTimeOffset validFrom,
        bool singleVisitUsed = false,
        DateTimeOffset? validTo = null,
        DateTimeOffset? paidAt = null,
        Guid? paidByUserId = null,
        string? professionalComment = null)
    {
        var saleId = Guid.NewGuid();
        var catalogItemId = behaviorKind switch
        {
            MembershipBehaviorKind.SingleVisit => SingleVisitCatalogItemId,
            MembershipBehaviorKind.Professional => ProfessionalCatalogItemId,
            _ => TermCatalogItemId
        };
        DateTimeOffset? resolvedPaidAt = isPaid ? paidAt ?? validFrom : null;
        Guid? resolvedPaidByUserId = isPaid ? paidByUserId ?? changedByUserId : null;

        return new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = saleId,
            MembershipCatalogItemId = catalogItemId,
            BehaviorKind = behaviorKind,
            IndividualValidFrom = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : purchaseDate,
            IndividualValidTo = behaviorKind == MembershipBehaviorKind.SingleVisit ? null : expirationDate,
            PaymentAmount = paymentAmount,
            IsPaid = isPaid,
            SingleVisitUsed = singleVisitUsed,
            ProfessionalComment = professionalComment,
            PaidByUserId = resolvedPaidByUserId,
            PaidAt = resolvedPaidAt,
            ValidFrom = validFrom,
            ValidTo = validTo,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ChangedByUserId = changedByUserId,
            CreatedAt = validFrom,
            Sale = new ClientMembershipSale
            {
                Id = saleId,
                ClientId = clientId,
                MembershipCatalogItemId = catalogItemId,
                BehaviorKind = behaviorKind,
                PurchaseDate = purchaseDate,
                GrossAmount = paymentAmount,
                CreatedByUserId = changedByUserId,
                CreatedAt = validFrom
            }
        };
    }

    private class TestClientPhotoImageProcessorProxy : DispatchProxy
    {
        public object? ConversionResult { get; set; }

        protected override object? Invoke(System.Reflection.MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod is { Name: "ConvertHeifToJpeg" })
            {
                return ConversionResult;
            }

            return null;
        }
    }

    private sealed record SeededClientsData(
        Guid HeadCoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
        Guid CoachId,
        string CoachLogin,
        string SharedPassword,
        Guid BranchId,
        Guid HallOneId,
        Guid HallTwoId,
        Guid GroupOneId,
        Guid GroupTwoId,
        Guid ArchivedClientId);

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
        bool CanMarkAttendance,
        bool CanViewAuditLog);

    private sealed record LoginRequest(string Login, string Password);

    private sealed class ClientsAppFactory(IReadOnlyDictionary<string, string?>? configurationOverrides = null) : WebApplicationFactory<Program>
    {
        public string PhotoStorageRootPath { get; } = Path.Combine(
            Path.GetTempPath(),
            $"gym-crm-client-photos-tests-{Guid.NewGuid():N}");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                var settings = new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage6a",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 6a",
                    ["ClientPhoto:StorageRootPath"] = PhotoStorageRootPath,
                    ["ClientPhoto:MaxUploadSizeBytes"] = "10485760"
                };
                if (configurationOverrides is not null)
                    foreach (var setting in configurationOverrides) settings[setting.Key] = setting.Value;
                configurationBuilder.AddInMemoryCollection(settings);
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                var clientPhotoImageProcessor = services.FirstOrDefault(
                    service => string.Equals(
                        service.ServiceType.FullName,
                        "GymCrm.Infrastructure.Clients.IClientPhotoImageProcessor",
                        StringComparison.Ordinal));

                if (clientPhotoImageProcessor is not null)
                {
                    services.Remove(clientPhotoImageProcessor);
                    var testProcessorFactory = CreateTestClientPhotoImageProcessor(null!);
                    if (testProcessorFactory is not null)
                    {
                        services.AddTransient(
                            clientPhotoImageProcessor.ServiceType,
                            provider => testProcessorFactory(provider)!);
                    }
                }

                var databaseName = $"gym-crm-clients-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);

            if (!disposing || !Directory.Exists(PhotoStorageRootPath))
            {
                return;
            }

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
