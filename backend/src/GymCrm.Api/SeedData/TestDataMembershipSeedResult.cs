using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Api.SeedData;

internal sealed record TestDataMembershipSeedResult(
    IReadOnlyList<MembershipCatalogItem> CatalogItems,
    IReadOnlyList<ClientMembershipSale> Sales,
    IReadOnlyList<ClientMembership> Memberships,
    int AnnualCount,
    int MonthlyCount,
    int ProfessionalCount,
    int WithoutMembershipCount);
