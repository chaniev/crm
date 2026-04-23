using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using GymCrm.Application.Security;
using GymCrm.Domain.Attendance;
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

public class ClientsApiTests
{
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
            var groupsPayload = GetArrayPayload(getPayload.GetProperty("groups"));
            Assert.Equal(2, groupsPayload.GetArrayLength());
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
            Assert.Equal(2, GetArrayPayload(updatePayload.GetProperty("contacts")).GetArrayLength());
        }

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var persistedClient = await dbContext.Clients
                .Include(candidate => candidate.Contacts)
                .Include(candidate => candidate.Groups)
                .SingleAsync(candidate => candidate.Id == clientId);

            Assert.Equal("+79990001199", persistedClient.Phone);
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
    public async Task HeadCoach_or_Administrator_can_list_expiring_memberships_for_home_screen(
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
            MembershipType membershipType,
            DateOnly? expirationDate)
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
            var isPaid = lastName != "Zebra";

            dbContext.ClientMemberships.Add(new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = createdClientId,
                MembershipType = membershipType,
                PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                ExpirationDate = expirationDate,
                PaymentAmount = 1200m,
                IsPaid = isPaid,
                SingleVisitUsed = false,
                PaidByUserId = isPaid ? seeded.HeadCoachId : null,
                PaidAt = isPaid ? now : null,
                ValidFrom = now,
                ValidTo = null,
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ChangedByUserId = seeded.HeadCoachId,
                CreatedAt = now
            });

            await dbContext.SaveChangesAsync();

            return createdClientId;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var expiringSoonClient = await CreateClientWithMembershipAsync(
            "Zebra",
            MembershipType.Monthly,
            today.AddDays(2));
        var laterExpiringClient = await CreateClientWithMembershipAsync(
            "Aaron",
            MembershipType.Yearly,
            today.AddDays(8));
        var notExpiringClient = await CreateClientWithMembershipAsync(
            "Eta",
            MembershipType.Monthly,
            today.AddDays(10));
        var noExpirationClient = await CreateClientWithMembershipAsync(
            "Omega",
            MembershipType.SingleVisit,
            expirationDate: null);

        using (var listResponse = await client.GetAsync("/clients/expiring-memberships"))
        {
            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

            var listPayload = await ReadJsonElementAsync(listResponse);
            var clientsPayload = GetArrayPayload(listPayload, "data", "items", "clients");
            var clientItems = clientsPayload.EnumerateArray().ToArray();
            Assert.Equal(2, clientItems.Length);

            var resultClientIds = clientItems
                .Select(item => GetGuidFromAnyCase(item, "id", "Id", "clientId", "ClientId"))
                .ToArray();
            Assert.Contains(expiringSoonClient, resultClientIds);
            Assert.Contains(laterExpiringClient, resultClientIds);
            Assert.DoesNotContain(notExpiringClient, resultClientIds);
            Assert.DoesNotContain(noExpirationClient, resultClientIds);

            Assert.Equal(
                [expiringSoonClient, laterExpiringClient],
                resultClientIds);

            var firstClient = clientItems[0];
            Assert.Equal("Zebra Тест А", GetStringFromAnyCase(firstClient, "fullName", "FullName"));
            Assert.Equal("Monthly", GetStringFromAnyCase(firstClient, "membershipType", "MembershipType"));
            Assert.Equal(today.AddDays(2).ToString("yyyy-MM-dd"), GetStringFromAnyCase(firstClient, "expirationDate", "ExpirationDate"));
            Assert.Equal(2L, GetLongFromAnyCase(firstClient, "daysUntilExpiration", "DaysUntilExpiration"));
            Assert.False(GetBoolFromAnyCase(firstClient, "isPaid", "IsPaid"));

            var secondClient = clientItems[1];
            Assert.Equal("Aaron Тест А", GetStringFromAnyCase(secondClient, "fullName", "FullName"));
            Assert.Equal("Yearly", GetStringFromAnyCase(secondClient, "membershipType", "MembershipType"));
            Assert.Equal(today.AddDays(8).ToString("yyyy-MM-dd"), GetStringFromAnyCase(secondClient, "expirationDate", "ExpirationDate"));
            Assert.Equal(8L, GetLongFromAnyCase(secondClient, "daysUntilExpiration", "DaysUntilExpiration"));
            Assert.True(GetBoolFromAnyCase(secondClient, "isPaid", "IsPaid"));
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
                       MembershipType = "Monthly",
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
                GroupId = seeded.GroupTwoId
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
                       MembershipType = "Monthly",
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
                GroupId = seeded.GroupTwoId
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
                        "groupScheduleText"
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

            var groupsPayload = GetArrayPayload(clientPayload.GetProperty("groups"));
            Assert.Single(groupsPayload.EnumerateArray());
            Assert.Equal(seeded.GroupOneId, GetGuidFromProperty(groupsPayload[0], "id"));
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
            params (DateOnly? ExpirationDate, int ValidFromOffsetMinutes, MembershipType MembershipType, bool IsPaid)[] memberships)
        {
            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var baseTimestamp = DateTimeOffset.UtcNow;

            foreach (var membership in memberships)
            {
                var validFrom = baseTimestamp.AddMinutes(membership.ValidFromOffsetMinutes);

                dbContext.ClientMemberships.Add(new ClientMembership
                {
                    Id = Guid.NewGuid(),
                    ClientId = clientId,
                    MembershipType = membership.MembershipType,
                    PurchaseDate = today,
                    ExpirationDate = membership.ExpirationDate,
                    PaymentAmount = 1000m,
                    IsPaid = membership.IsPaid,
                    SingleVisitUsed = false,
                    PaidByUserId = membership.IsPaid ? seeded.HeadCoachId : null,
                    PaidAt = membership.IsPaid ? validFrom : null,
                    ValidFrom = validFrom,
                    ValidTo = null,
                    ChangeReason = ClientMembershipChangeReason.NewPurchase,
                    ChangedByUserId = seeded.HeadCoachId,
                    CreatedAt = validFrom
                });
            }

            await dbContext.SaveChangesAsync();
        }

        var paidClientId = await CreateClientForFilterAsync("Иванов", "Платный", "+79990004001", [seeded.GroupOneId]);
        var unpaidClientId = await CreateClientForFilterAsync("Петров", "Неоплаченный", "+79990004002", [seeded.GroupTwoId]);
        var noGroupNoPhotoClientId = await CreateClientForFilterAsync("Сидоров", "Без", "+79990004003", []);

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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
                       PurchaseDate = today.ToString("yyyy-MM-dd"),
                       ExpirationDate = today.AddMonths(1).ToString("yyyy-MM-dd"),
                       PaymentAmount = 500m,
                       IsPaid = false
                   },
                   actorSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, unpaidMembershipResponse.StatusCode);
        }

        var fullNameSearch = await QueryClientIdsAsync($"?fullName={Uri.EscapeDataString("Иванов")}");
        Assert.Single(fullNameSearch);
        Assert.Equal(paidClientId, fullNameSearch[0]);

        var phoneSearch = await QueryClientIdsAsync($"?phone={Uri.EscapeDataString("+79990004002")}");
        Assert.Single(phoneSearch);
        Assert.Equal(unpaidClientId, phoneSearch[0]);

        var activeStatus = await QueryClientIdsAsync("?status=Active");
        Assert.Contains(paidClientId, activeStatus);
        Assert.Contains(unpaidClientId, activeStatus);
        Assert.Contains(noGroupNoPhotoClientId, activeStatus);

        var groupOneClients = await QueryClientIdsAsync($"?groupId={seeded.GroupOneId}");
        Assert.Single(groupOneClients);
        Assert.Equal(paidClientId, groupOneClients[0]);

        var activePaid = await QueryClientIdsAsync("?paymentStatus=Paid");
        Assert.Single(activePaid);
        Assert.Equal(paidClientId, activePaid[0]);

        var membershipRange = await QueryClientIdsAsync(
            $"?membershipExpiresFrom={today.AddDays(25):yyyy-MM-dd}&membershipExpiresTo={today.AddDays(35):yyyy-MM-dd}");
        Assert.Contains(paidClientId, membershipRange);
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
        Assert.Single(withoutGroup);
        Assert.Equal(noGroupNoPhotoClientId, withoutGroup[0]);

        var withoutActivePaid = await QueryClientIdsAsync("?hasActivePaidMembership=false");
        Assert.Contains(unpaidClientId, withoutActivePaid);
        Assert.Contains(noGroupNoPhotoClientId, withoutActivePaid);
        Assert.DoesNotContain(paidClientId, withoutActivePaid);

        var earlyAlphabetClientId = await CreateClientForFilterAsync("Аарон", "Ранний", "+79990004010", [seeded.GroupOneId]);
        var staleCurrentMembershipClientId = await CreateClientForFilterAsync("Борисов", "Спорный", "+79990004011", [seeded.GroupOneId]);
        var firstFilteredPageClientId = await CreateClientForFilterAsync("Викторов", "Первый", "+79990004012", [seeded.GroupOneId]);
        var secondFilteredPageClientId = await CreateClientForFilterAsync("Громов", "Второй", "+79990004013", [seeded.GroupOneId]);

        await SeedCurrentMembershipsAsync(
            earlyAlphabetClientId,
            (today.AddDays(5), 1, MembershipType.SingleVisit, true));
        await SeedCurrentMembershipsAsync(
            staleCurrentMembershipClientId,
            (today.AddDays(28), 1, MembershipType.SingleVisit, true),
            (today.AddDays(40), 2, MembershipType.SingleVisit, true));
        await SeedCurrentMembershipsAsync(
            firstFilteredPageClientId,
            (today.AddDays(29), 1, MembershipType.SingleVisit, true));
        await SeedCurrentMembershipsAsync(
            secondFilteredPageClientId,
            (today.AddDays(32), 1, MembershipType.SingleVisit, false));

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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
                       MembershipType = "Yearly",
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
                       MembershipType = "Yearly",
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
        Assert.Equal("Yearly", GetStringFromAnyCase(currentMembership, "membershipType", "MembershipType"));
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
        Assert.Equal(1, memberships.Count(membership => membership.ValidTo is null));
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
                MembershipType = "Monthly",
                PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false,
                SingleVisitUsed = false
            },
            ["renew"] = new
            {
                MembershipType = "Monthly",
                RenewalDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false
            },
            ["correct"] = new
            {
                MembershipType = "Monthly",
                PurchaseDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).ToString("yyyy-MM-dd"),
                ExpirationDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddMonths(1).ToString("yyyy-MM-dd"),
                PaymentAmount = 1000m,
                IsPaid = false,
                SingleVisitUsed = false
            },
            ["mark-payment"] = new
            {
                IsPaid = true,
                MembershipType = "Monthly"
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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
            Assert.Equal(1, memberships.Count(membership => membership.ValidTo is null));
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
        var firstExpirationDate = purchaseDate.AddMonths(1);
        var renewalDate = purchaseDate.AddDays(10);

        using (var purchaseResponse = await SendMembershipActionAsync(
                   client,
                   "purchase",
                   clientId,
                   new
                   {
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
        var current = memberships.Single(m => m.ValidTo is null);
        Assert.Equal(firstExpirationDate.AddMonths(1), current.ExpirationDate);
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
            dbContext.ClientMemberships.Add(new ClientMembership
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                MembershipType = MembershipType.Monthly,
                PurchaseDate = currentDate.AddMonths(-3),
                ExpirationDate = oldExpiration,
                PaymentAmount = 700m,
                IsPaid = true,
                SingleVisitUsed = false,
                PaidByUserId = seeded.HeadCoachId,
                PaidAt = DateTimeOffset.UtcNow.AddMonths(-2),
                ValidFrom = DateTimeOffset.UtcNow.AddMonths(-2),
                ValidTo = null,
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ChangedByUserId = seeded.HeadCoachId,
                CreatedAt = DateTimeOffset.UtcNow.AddMonths(-2)
            });

            await dbContext.SaveChangesAsync();
        }

        var renewalDate = currentDate;
        using (var renewResponse = await SendMembershipActionAsync(
                   client,
                   "renew",
                   clientId,
                   new
                   {
                       MembershipType = "Monthly",
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
        var current = memberships.Single(membership => membership.ValidTo is null);
        Assert.Equal(renewalDate.AddMonths(1), current.ExpirationDate);
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
                       MembershipType = "SingleVisit",
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
                       MembershipType = "SingleVisit",
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
            Assert.Equal(MembershipType.SingleVisit, secondCurrent.MembershipType);
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
                       MembershipType = "Monthly",
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

        var markStartedAt = DateTimeOffset.UtcNow;
        using (var paymentResponse = await SendMembershipActionAsync(
                   client,
                   "mark-payment",
                   clientId,
                   new
                   {
                       MembershipType = "Monthly",
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
            Assert.True(current.PaidAt >= markStartedAt);
            Assert.True(current.PaidAt <= DateTimeOffset.UtcNow.AddMinutes(1));
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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
                       MembershipType = "Monthly",
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
        Assert.True(errorsPayload.TryGetProperty("fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].type", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].fullName", out _));
        Assert.True(errorsPayload.TryGetProperty("contacts[0].phone", out _));
        Assert.True(errorsPayload.TryGetProperty("groupIds", out _));
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

        Assert.Contains(auditLogs, log => log.ActionType == "ClientCreated");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientUpdated");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientArchived");
        Assert.Contains(auditLogs, log => log.ActionType == "ClientRestored");

        foreach (var log in auditLogs)
        {
            AssertNoPasswordInAuditState(log.OldValueJson);
            AssertNoPasswordInAuditState(log.NewValueJson);
        }
    }

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

        var groupOne = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group One",
            TrainingStartTime = new TimeOnly(9, 0),
            ScheduleText = "Пн-Ср-Пт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var groupTwo = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            Name = "Group Two",
            TrainingStartTime = new TimeOnly(18, 30),
            ScheduleText = "Вт-Чт",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var archivedClient = new Client
        {
            Id = Guid.NewGuid(),
            LastName = "Архивный",
            FirstName = "Клиент",
            Phone = "+79990001000",
            Status = ClientStatus.Archived,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.TrainingGroups.AddRange(groupOne, groupTwo);
        dbContext.Clients.Add(archivedClient);
        await dbContext.SaveChangesAsync();

        return new SeededClientsData(
            headCoach.Id,
            headCoach.Login,
            administrator.Login,
            coach.Id,
            coach.Login,
            sharedPassword,
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
        using var createResponse = await PostJsonAsync(
            client,
            "/clients",
            new
            {
                LastName = "Membership",
                FirstName = "Client",
                MiddleName = "Tests",
                Phone = $"+7999000{Guid.NewGuid():N}".Substring(0, 11),
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
                if (property.Name.Equals("membershipType", StringComparison.OrdinalIgnoreCase) ||
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

    private sealed class ClientsAppFactory : WebApplicationFactory<Program>
    {
        public string PhotoStorageRootPath { get; } = Path.Combine(
            Path.GetTempPath(),
            $"gym-crm-client-photos-tests-{Guid.NewGuid():N}");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["BootstrapUser:Login"] = "bootstrap-stage6a",
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 6a",
                    ["ClientPhoto:StorageRootPath"] = PhotoStorageRootPath,
                    ["ClientPhoto:MaxUploadSizeBytes"] = "10485760"
                });
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
