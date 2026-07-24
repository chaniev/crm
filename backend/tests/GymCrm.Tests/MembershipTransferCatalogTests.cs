using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
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

public sealed class MembershipTransferCatalogTests
{
    [Fact]
    public async Task Term_transfer_changes_branch_and_group_and_creates_membership_sale()
    {
        await using var fixture = await TransferFixture.CreateAsync(MembershipBehaviorKind.Term);
        var before = await fixture.CountsAsync();

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId },
            MembershipCatalogItemId = fixture.TargetTermCatalogItemId,
            ValidFrom = fixture.Today.ToString("yyyy-MM-dd"),
            ValidTo = fixture.Today.AddMonths(1).ToString("yyyy-MM-dd"),
            PaymentStatus = "Paid",
            PaymentDate = fixture.Today.ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await fixture.AssertAssignmentAsync(fixture.TargetBranchId, fixture.TargetGroupId);
        var after = await fixture.CountsAsync();
        Assert.Equal(before.Memberships + 1, after.Memberships);
        Assert.Equal(before.Sales + 1, after.Sales);
        var sale = await fixture.LatestSaleAsync();
        Assert.Equal(ClientMembershipSalePricingMode.Catalog, sale.PricingMode);
        Assert.Equal(1500m, sale.GrossAmount);
        Assert.Equal(fixture.TargetTermCatalogItemId, sale.MembershipCatalogItemId);
    }

    [Fact]
    public async Task Term_transfer_supports_catalog_override()
    {
        await using var fixture = await TransferFixture.CreateAsync(MembershipBehaviorKind.Term);

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId },
            MembershipCatalogItemId = fixture.TargetTermCatalogItemId,
            ManualSaleAmount = 1750m,
            ValidFrom = fixture.Today.ToString("yyyy-MM-dd"),
            ValidTo = fixture.Today.AddDays(29).ToString("yyyy-MM-dd"),
            PaymentDate = fixture.Today.ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sale = await fixture.LatestSaleAsync();
        Assert.Equal(ClientMembershipSalePricingMode.CatalogOverride, sale.PricingMode);
        Assert.Equal(1750m, sale.GrossAmount);
        Assert.Equal(fixture.TargetTermCatalogItemId, sale.MembershipCatalogItemId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Amount_only_transfer_works_without_current_membership_and_replaces_professional(bool replaceProfessional)
    {
        await using var fixture = await TransferFixture.CreateAsync(
            replaceProfessional ? MembershipBehaviorKind.Professional : null);

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId },
            MembershipCatalogItemId = (Guid?)null,
            ManualSaleAmount = 1800m,
            ValidFrom = fixture.Today.ToString("yyyy-MM-dd"),
            ValidTo = fixture.Today.AddDays(29).ToString("yyyy-MM-dd"),
            PaymentStatus = "Paid",
            PaymentDate = fixture.Today.ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await fixture.AssertAssignmentAsync(fixture.TargetBranchId, fixture.TargetGroupId);
        var sale = await fixture.LatestSaleAsync();
        Assert.Equal(ClientMembershipSalePricingMode.AmountOnly, sale.PricingMode);
        Assert.Equal(MembershipBehaviorKind.Term, sale.BehaviorKind);
        Assert.Equal(1800m, sale.GrossAmount);
        Assert.Null(sale.MembershipCatalogItemId);
        var membership = await fixture.LatestMembershipAsync();
        Assert.Equal(MembershipBehaviorKind.Term, membership.BehaviorKind);
        Assert.Equal(fixture.Today, membership.IndividualValidFrom);
        Assert.Equal(fixture.Today.AddDays(29), membership.IndividualValidTo);
    }

    [Fact]
    public async Task Failed_membership_validation_rolls_back_branch_group_and_financial_changes()
    {
        await using var fixture = await TransferFixture.CreateAsync(MembershipBehaviorKind.Term);
        var before = await fixture.CountsAsync();

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId },
            MembershipCatalogItemId = fixture.SourceOnlyCatalogItemId,
            ValidFrom = fixture.Today.ToString("yyyy-MM-dd"),
            ValidTo = fixture.Today.AddMonths(1).ToString("yyyy-MM-dd"),
            PaymentStatus = "Paid",
            PaymentDate = fixture.Today.ToString("yyyy-MM-dd")
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await fixture.AssertAssignmentAsync(fixture.SourceBranchId, groupId: null);
        Assert.Equal(before, await fixture.CountsAsync());
    }

    [Fact]
    public async Task Unused_single_visit_transfer_preserves_membership_sale_and_creates_no_financial_event()
    {
        await using var fixture = await TransferFixture.CreateAsync(MembershipBehaviorKind.SingleVisit);
        var before = await fixture.CountsAsync();
        var original = await fixture.CurrentMembershipIdsAsync();

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await fixture.AssertAssignmentAsync(fixture.TargetBranchId, fixture.TargetGroupId);
        Assert.Equal(before, await fixture.CountsAsync());
        Assert.Equal(original, await fixture.CurrentMembershipIdsAsync());
    }

    [Fact]
    public async Task Unused_single_visit_transfer_rejects_explicit_null_sale_fields_without_changes()
    {
        await using var fixture = await TransferFixture.CreateAsync(MembershipBehaviorKind.SingleVisit);
        var before = await fixture.CountsAsync();
        var original = await fixture.CurrentMembershipIdsAsync();

        using var response = await fixture.TransferAsync(new
        {
            TargetBranchId = fixture.TargetBranchId,
            TargetGroupIds = new[] { fixture.TargetGroupId },
            MembershipCatalogItemId = (Guid?)null,
            ManualSaleAmount = (decimal?)null
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await fixture.AssertAssignmentAsync(fixture.SourceBranchId, groupId: null);
        Assert.Equal(before, await fixture.CountsAsync());
        Assert.Equal(original, await fixture.CurrentMembershipIdsAsync());
    }

    private sealed class TransferFixture : IAsyncDisposable
    {
        private const string Password = "transfer-catalog-password";
        private readonly TransferAppFactory _factory;
        private readonly HttpClient _client;
        private readonly string _csrfToken;

        private TransferFixture(
            TransferAppFactory factory,
            HttpClient client,
            string csrfToken,
            Guid clientId,
            Guid sourceBranchId,
            Guid targetBranchId,
            Guid targetGroupId,
            Guid targetTermCatalogItemId,
            Guid sourceOnlyCatalogItemId,
            DateOnly today)
        {
            _factory = factory;
            _client = client;
            _csrfToken = csrfToken;
            ClientId = clientId;
            SourceBranchId = sourceBranchId;
            TargetBranchId = targetBranchId;
            TargetGroupId = targetGroupId;
            TargetTermCatalogItemId = targetTermCatalogItemId;
            SourceOnlyCatalogItemId = sourceOnlyCatalogItemId;
            Today = today;
        }

        public Guid ClientId { get; }
        public Guid SourceBranchId { get; }
        public Guid TargetBranchId { get; }
        public Guid TargetGroupId { get; }
        public Guid TargetTermCatalogItemId { get; }
        public Guid SourceOnlyCatalogItemId { get; }
        public DateOnly Today { get; }

        public static async Task<TransferFixture> CreateAsync(MembershipBehaviorKind? initialBehavior)
        {
            var factory = new TransferAppFactory();
            var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true
            });
            Guid clientId;
            Guid sourceBranchId;
            Guid targetBranchId;
            Guid targetGroupId;
            Guid targetTermCatalogItemId;
            Guid sourceOnlyCatalogItemId;
            DateOnly today;

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
                var hashes = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
                today = scope.ServiceProvider.GetRequiredService<IBusinessDateProvider>().Today;
                var now = DateTimeOffset.UtcNow;

                var coach = new User
                {
                    Id = Guid.NewGuid(), Login = "transfer-head-coach", FullName = "Transfer Head Coach",
                    Role = UserRole.HeadCoach, IsActive = true, MustChangePassword = false,
                    CreatedAt = now, UpdatedAt = now
                };
                coach.PasswordHash = hashes.HashPassword(coach, Password);
                var source = CreateBranch("Source", now);
                var target = CreateBranch("Target", now);
                var hall = new Hall
                {
                    Id = Guid.NewGuid(), BranchId = target.Id, Name = "Target hall", IsArchived = false,
                    CreatedAt = now, UpdatedAt = now
                };
                var groupType = new GroupType { Id = Guid.NewGuid(), Name = "Transfer", CreatedAt = now, UpdatedAt = now };
                var group = new TrainingGroup
                {
                    Id = Guid.NewGuid(), BranchId = target.Id, HallId = hall.Id, GroupTypeId = groupType.Id,
                    Name = "Target group", TrainingStartTime = new TimeOnly(12, 0), DurationMinutes = 60,
                    Weekdays = [1], IsActive = true, CreatedAt = now, UpdatedAt = now
                };
                var targetTerm = MembershipCatalogItem.CreateBranchOwned(
                    target.Id, "Target Term", 1500m, MembershipBehaviorKind.Term, today.AddDays(-1), null, now);
                var sourceTerm = MembershipCatalogItem.CreateBranchOwned(
                    source.Id, "Source Term", 1100m, MembershipBehaviorKind.Term, today.AddDays(-1), null, now);
                var initialCatalog = initialBehavior switch
                {
                    MembershipBehaviorKind.SingleVisit => MembershipCatalogItem.CreateBranchOwned(
                        source.Id, "Source Visit", 400m, MembershipBehaviorKind.SingleVisit, today.AddDays(-1), null, now),
                    MembershipBehaviorKind.Term => sourceTerm,
                    MembershipBehaviorKind.Professional => db.MembershipCatalogItems
                        .Single(item => item.BehaviorKind == MembershipBehaviorKind.Professional),
                    null => null,
                    _ => throw new ArgumentOutOfRangeException(nameof(initialBehavior))
                };
                var crmClient = new Client
                {
                    Id = Guid.NewGuid(), BranchId = source.Id, LastName = "Transfer", FirstName = "Client",
                    Phone = "+79990009999", Status = ClientStatus.Active, CreatedAt = now, UpdatedAt = now
                };
                db.AddRange(coach, source, target, hall, groupType, group, targetTerm, sourceTerm, crmClient);
                if (initialCatalog is not null && initialCatalog != sourceTerm &&
                    initialBehavior != MembershipBehaviorKind.Professional)
                    db.Add(initialCatalog);
                if (initialBehavior.HasValue && initialCatalog is not null)
                {
                    var sale = new ClientMembershipSale
                    {
                        Id = Guid.NewGuid(), ClientId = crmClient.Id, MembershipCatalogItemId = initialCatalog.Id,
                        MembershipCatalogItem = initialCatalog, BehaviorKind = initialBehavior.Value,
                        PricingMode = ClientMembershipSalePricingMode.Catalog,
                        PurchaseDate = today, PaymentDate = today, GrossAmount = initialCatalog.Price,
                        CreatedByUserId = coach.Id, CreatedAt = now
                    };
                    var membership = new ClientMembership
                    {
                        Id = Guid.NewGuid(), ClientId = crmClient.Id, SaleId = sale.Id,
                        BehaviorKind = initialBehavior.Value,
                        IndividualValidFrom = initialBehavior == MembershipBehaviorKind.SingleVisit ? null : today,
                        IndividualValidTo = initialBehavior == MembershipBehaviorKind.Term ? today.AddMonths(1) : null,
                        SingleVisitUsed = false,
                        ValidFrom = now,
                        ChangeReason = ClientMembershipChangeReason.NewPurchase, ChangedByUserId = coach.Id, CreatedAt = now
                    };
                    db.AddRange(sale, membership);
                }
                await db.SaveChangesAsync();

                clientId = crmClient.Id;
                sourceBranchId = source.Id;
                targetBranchId = target.Id;
                targetGroupId = group.Id;
                targetTermCatalogItemId = targetTerm.Id;
                sourceOnlyCatalogItemId = sourceTerm.Id;
            }

            var session = await client.GetFromJsonAsync<JsonElement>("/auth/session");
            var csrf = session.GetProperty("csrfToken").GetString()!;
            using var login = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
            {
                Content = JsonContent.Create(new { Login = "transfer-head-coach", Password })
            };
            login.Headers.Add("X-CSRF-TOKEN", csrf);
            using var loginResponse = await client.SendAsync(login);
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
            var loginPayload = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();

            return new TransferFixture(factory, client, loginPayload.GetProperty("csrfToken").GetString()!,
                clientId, sourceBranchId, targetBranchId, targetGroupId, targetTermCatalogItemId,
                sourceOnlyCatalogItemId, today);
        }

        public async Task<HttpResponseMessage> TransferAsync<T>(T payload)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"/clients/{ClientId}/transfer")
            {
                Content = JsonContent.Create(payload)
            };
            request.Headers.Add("X-CSRF-TOKEN", _csrfToken);
            request.Headers.Add("Idempotency-Key", $"transfer-{Guid.NewGuid():N}");
            return await _client.SendAsync(request);
        }

        public async Task<(int Memberships, int Sales)> CountsAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return (await db.ClientMemberships.CountAsync(x => x.ClientId == ClientId),
                await db.ClientMembershipSales.CountAsync(x => x.ClientId == ClientId));
        }

        public async Task<(Guid MembershipId, Guid SaleId)> CurrentMembershipIdsAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            return await db.ClientMemberships.Where(x => x.ClientId == ClientId && x.ValidTo == null)
                .Select(x => new ValueTuple<Guid, Guid>(x.Id, x.SaleId)).SingleAsync();
        }

        public async Task<ClientMembershipSale> LatestSaleAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var sales = await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
                .ClientMembershipSales.AsNoTracking().Where(sale => sale.ClientId == ClientId)
                .ToArrayAsync();
            return sales.OrderByDescending(sale => sale.CreatedAt).First();
        }

        public async Task<ClientMembership> LatestMembershipAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var memberships = await scope.ServiceProvider.GetRequiredService<GymCrmDbContext>()
                .ClientMemberships.AsNoTracking().Where(membership => membership.ClientId == ClientId)
                .ToArrayAsync();
            return memberships.OrderByDescending(membership => membership.CreatedAt).First();
        }

        public async Task AssertAssignmentAsync(Guid branchId, Guid? groupId)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var value = await db.Clients.Include(x => x.Groups).SingleAsync(x => x.Id == ClientId);
            Assert.Equal(branchId, value.BranchId);
            if (groupId.HasValue) Assert.Contains(value.Groups, x => x.GroupId == groupId);
            else Assert.Empty(value.Groups);
        }

        public async ValueTask DisposeAsync()
        {
            _client.Dispose();
            await _factory.DisposeAsync();
        }

        private static Branch CreateBranch(string name, DateTimeOffset now) => new()
        {
            Id = Guid.NewGuid(), Name = name, Address = $"{name} address", IsArchived = false,
            CreatedAt = now, UpdatedAt = now
        };
    }

    private sealed class TransferAppFactory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _connection = new("Data Source=:memory:");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Database=unused",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false"
                }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IDbContextOptionsConfiguration<GymCrmDbContext>>();
                var sqliteProvider = new ServiceCollection()
                    .AddEntityFrameworkSqlite()
                    .BuildServiceProvider();
                _connection.Open();
                _connection.CreateFunction<string?, string?>("btrim", value => value?.Trim(), isDeterministic: true);
                _connection.CreateFunction<string?, int>("cardinality", value =>
                    string.IsNullOrWhiteSpace(value)
                        ? 0
                        : JsonDocument.Parse(value).RootElement.GetArrayLength(),
                    isDeterministic: true);
                var bootstrapOptions = new DbContextOptionsBuilder<GymCrmDbContext>()
                    .UseSqlite(_connection)
                    .UseInternalServiceProvider(sqliteProvider)
                    .Options;
                using (var bootstrapContext = new GymCrmDbContext(bootstrapOptions))
                {
                    bootstrapContext.Database.EnsureCreated();
                }
                services.AddDbContext<GymCrmDbContext>(options => options
                    .UseSqlite(_connection)
                    .UseInternalServiceProvider(sqliteProvider));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }
}
