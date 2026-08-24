using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal static class TestDataMembershipSeed
{
    public const int AnnualCount = SeedIds.ClientCount * 50 / 100;
    public const int MonthlyCount = SeedIds.ClientCount * 30 / 100;
    public const int ProfessionalCount = SeedIds.ClientCount * 5 / 100;
    public const int WithoutMembershipCount = SeedIds.ClientCount - AnnualCount - MonthlyCount - ProfessionalCount;
    public const int SecondaryGroupClientCount = (SeedIds.ClientCount - ProfessionalCount + 5) / 10;

    private const decimal AnnualPrice = 60_000m;
    private const decimal MonthlyPrice = 6_000m;

    public static async Task<TestDataMembershipSeedResult> CreateAsync(
        GymCrmDbContext dbContext,
        IReadOnlyList<Client> clients,
        IReadOnlyList<ClientGroup> groupLinks,
        Guid actorUserId,
        DateOnly startsOn,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var professionalCatalogItem = await dbContext.MembershipCatalogItems
            .AsNoTracking()
            .SingleAsync(item => item.BehaviorKind == MembershipBehaviorKind.Professional, cancellationToken);
        var catalogItems = CreateTermCatalogItems(startsOn, now);
        var catalogByBranchAndDuration = catalogItems.ToDictionary(
            item => (item.BranchId!.Value, item.Name),
            item => item);
        var sales = new List<ClientMembershipSale>(AnnualCount + MonthlyCount + ProfessionalCount);
        var memberships = new List<ClientMembership>(sales.Capacity);

        for (var index = 0; index < clients.Count; index++)
        {
            var clientNumber = index + 1;
            var client = clients[index];
            var definition = ResolveDefinition(
                clientNumber,
                client.BranchId,
                startsOn,
                professionalCatalogItem,
                catalogByBranchAndDuration);
            if (definition is null)
            {
                continue;
            }

            var saleId = SeedIds.MembershipSale(clientNumber);
            var membershipId = SeedIds.Membership(clientNumber);
            var sale = new ClientMembershipSale
            {
                Id = saleId,
                ClientId = client.Id,
                MembershipCatalogItemId = definition.CatalogItemId,
                BehaviorKind = definition.BehaviorKind,
                PricingMode = ClientMembershipSalePricingMode.Catalog,
                PurchaseDate = startsOn,
                PaymentDate = startsOn,
                GrossAmount = definition.Price,
                CreatedByUserId = actorUserId,
                CreatedAt = now
            };
            var membership = new ClientMembership
            {
                Id = membershipId,
                ClientId = client.Id,
                SaleId = saleId,
                BehaviorKind = definition.BehaviorKind,
                IndividualValidFrom = startsOn,
                IndividualValidTo = definition.ValidTo,
                ProfessionalComment = definition.BehaviorKind == MembershipBehaviorKind.Professional
                    ? "Тестовый профессиональный абонемент."
                    : null,
                ChangedByUserId = actorUserId,
                ChangeReason = ClientMembershipChangeReason.NewPurchase,
                ValidFrom = now,
                CreatedAt = now,
                Sale = sale
            };

            var clientGroupLinks = groupLinks
                .Where(link => link.ClientId == client.Id)
                .OrderBy(link => link.GroupId)
                .ToArray();
            for (var position = 0; position < clientGroupLinks.Length; position++)
            {
                var link = clientGroupLinks[position];
                membership.TargetGroups.Add(new ClientMembershipTargetGroup
                {
                    ClientMembershipId = membershipId,
                    GroupId = link.GroupId,
                    BranchId = link.BranchId,
                    Position = position
                });
                sale.TargetSnapshots.Add(new ClientMembershipSaleTargetSnapshot
                {
                    SaleId = saleId,
                    GroupId = link.GroupId,
                    BranchId = link.BranchId,
                    Position = position
                });
            }

            sales.Add(sale);
            memberships.Add(membership);
        }

        return new TestDataMembershipSeedResult(
            catalogItems,
            sales,
            memberships,
            AnnualCount,
            MonthlyCount,
            ProfessionalCount,
            WithoutMembershipCount);
    }

    private static List<MembershipCatalogItem> CreateTermCatalogItems(DateOnly availableFrom, DateTimeOffset now)
    {
        var result = new List<MembershipCatalogItem>(SeedIds.BranchCount * 2);

        for (var branchNumber = 1; branchNumber <= SeedIds.BranchCount; branchNumber++)
        {
            var branchId = SeedIds.Branch(branchNumber);
            var annual = MembershipCatalogItem.CreateBranchOwned(
                branchId,
                "Годовой тестовый",
                AnnualPrice,
                MembershipBehaviorKind.Term,
                availableFrom,
                null,
                now);
            annual.Id = SeedIds.MembershipCatalog(branchNumber, "annual");
            var monthly = MembershipCatalogItem.CreateBranchOwned(
                branchId,
                "Месячный тестовый",
                MonthlyPrice,
                MembershipBehaviorKind.Term,
                availableFrom,
                null,
                now);
            monthly.Id = SeedIds.MembershipCatalog(branchNumber, "monthly");
            result.Add(annual);
            result.Add(monthly);
        }

        return result;
    }

    private static MembershipDefinition? ResolveDefinition(
        int clientNumber,
        Guid branchId,
        DateOnly startsOn,
        MembershipCatalogItem professionalCatalogItem,
        IReadOnlyDictionary<(Guid BranchId, string Name), MembershipCatalogItem> catalogItems)
    {
        if (clientNumber <= AnnualCount)
        {
            var catalog = catalogItems[(branchId, "Годовой тестовый")];
            return new MembershipDefinition(
                catalog.Id,
                MembershipBehaviorKind.Term,
                catalog.Price,
                startsOn.AddYears(1).AddDays(-1));
        }

        if (clientNumber <= AnnualCount + MonthlyCount)
        {
            var catalog = catalogItems[(branchId, "Месячный тестовый")];
            return new MembershipDefinition(
                catalog.Id,
                MembershipBehaviorKind.Term,
                catalog.Price,
                startsOn.AddMonths(1).AddDays(-1));
        }

        if (clientNumber <= AnnualCount + MonthlyCount + ProfessionalCount)
        {
            return new MembershipDefinition(
                professionalCatalogItem.Id,
                MembershipBehaviorKind.Professional,
                professionalCatalogItem.Price,
                null);
        }

        return null;
    }

    private sealed record MembershipDefinition(
        Guid CatalogItemId,
        MembershipBehaviorKind BehaviorKind,
        decimal Price,
        DateOnly? ValidTo);
}
