using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using GymCrm.Application.Security;
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
    public async Task Coach_cannot_access_clients_management_endpoints()
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
            Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
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
        Assert.All(membershipIdsFromResponse, Assert.NotEqual(Guid.Empty));

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

        var actorSession = await LoginAsync(client, seeded.CoachLogin, seeded.SharedPassword);
        var clientId = await CreateClientForMembershipTestsAsync(
            client,
            actorSession.CsrfToken,
            seeded.GroupOneId);

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
            coach.Login,
            sharedPassword,
            groupOne.Id,
            groupTwo.Id,
            archivedClient.Id);
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

    private sealed record SeededClientsData(
        Guid HeadCoachId,
        string HeadCoachLogin,
        string AdministratorLogin,
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
                    ["BootstrapUser:FullName"] = "Bootstrap Stage 6a"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();

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
    }
}
