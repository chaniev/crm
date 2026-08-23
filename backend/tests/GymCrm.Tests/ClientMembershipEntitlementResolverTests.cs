using GymCrm.Application.Clients;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymCrm.Tests;

public sealed class ClientMembershipEntitlementResolverTests
{
    [Fact]
    public async Task Resolver_selects_term_by_target_and_professional_for_any_group()
    {
        await using var db = CreateDbContext();
        var seed = SeedBase(db);
        var term = AddMembership(db, seed.ClientId, seed.GroupAId, seed.BranchId, MembershipBehaviorKind.Term, seed.Today, seed.Today.AddDays(10));
        var resolver = new ClientMembershipEntitlementResolver(db, NullLogger<ClientMembershipEntitlementResolver>.Instance);

        var termResult = await resolver.ResolveAsync(seed.ClientId, seed.GroupAId, seed.Today, CancellationToken.None);
        Assert.Equal(ClientMembershipEntitlementResolutionStatus.Found, termResult.Status);
        Assert.Equal(term.Id, termResult.MembershipId);
        Assert.Equal(MembershipCoverageKind.TargetGroups, termResult.CoverageKind);

        term.ValidTo = DateTimeOffset.UtcNow;
        AddMembership(db, seed.ClientId, seed.GroupAId, seed.BranchId, MembershipBehaviorKind.Professional, seed.Today, null);
        await db.SaveChangesAsync();

        var professionalResult = await resolver.ResolveAsync(seed.ClientId, seed.GroupBId, seed.Today, CancellationToken.None);
        Assert.Equal(ClientMembershipEntitlementResolutionStatus.Found, professionalResult.Status);
        Assert.Equal(MembershipBehaviorKind.Professional, professionalResult.BehaviorKind);
        Assert.Equal(MembershipCoverageKind.AllGroups, professionalResult.CoverageKind);
    }

    [Fact]
    public async Task Resolver_returns_no_entitlement_for_empty_legacy_target_set()
    {
        await using var db = CreateDbContext();
        var seed = SeedBase(db);
        AddMembership(db, seed.ClientId, seed.GroupAId, seed.BranchId, MembershipBehaviorKind.Term, seed.Today, seed.Today.AddDays(10), addTarget: false);
        var resolver = new ClientMembershipEntitlementResolver(db, NullLogger<ClientMembershipEntitlementResolver>.Instance);

        var result = await resolver.ResolveAsync(seed.ClientId, seed.GroupAId, seed.Today, CancellationToken.None);

        Assert.Equal(ClientMembershipEntitlementResolutionStatus.NoEntitlement, result.Status);
    }

    [Fact]
    public async Task Resolver_returns_invariant_conflict_for_multiple_matching_entitlements()
    {
        await using var db = CreateDbContext();
        var seed = SeedBase(db);
        AddMembership(db, seed.ClientId, seed.GroupAId, seed.BranchId, MembershipBehaviorKind.Term, seed.Today, seed.Today.AddDays(10));
        AddMembership(db, seed.ClientId, seed.GroupAId, seed.BranchId, MembershipBehaviorKind.SingleVisit, null, null);
        var resolver = new ClientMembershipEntitlementResolver(db, NullLogger<ClientMembershipEntitlementResolver>.Instance);

        var result = await resolver.ResolveAsync(seed.ClientId, seed.GroupAId, seed.Today, CancellationToken.None);

        Assert.Equal(ClientMembershipEntitlementResolutionStatus.InvariantConflict, result.Status);
    }

    private static GymCrmDbContext CreateDbContext()
    {
        return new GymCrmDbContext(new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"membership-entitlement-resolver-{Guid.NewGuid():N}")
            .Options);
    }

    private static ResolverSeed SeedBase(GymCrmDbContext db)
    {
        var now = DateTimeOffset.UtcNow;
        var branch = new Branch { Id = Guid.NewGuid(), Name = "Resolver Branch", CreatedAt = now, UpdatedAt = now };
        var hall = new Hall { Id = Guid.NewGuid(), BranchId = branch.Id, Name = "Hall", CreatedAt = now, UpdatedAt = now };
        var groupType = new GroupType { Id = Guid.NewGuid(), Name = "Type", CreatedAt = now, UpdatedAt = now };
        var groupA = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "Group A",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1],
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupB = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "Group B",
            TrainingStartTime = new TimeOnly(12, 0),
            DurationMinutes = 60,
            Weekdays = [2],
            CreatedAt = now,
            UpdatedAt = now
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Phone = "+79000000000",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.AddRange(branch, hall, groupType, groupA, groupB, client);
        db.SaveChanges();
        return new ResolverSeed(client.Id, branch.Id, groupA.Id, groupB.Id, new DateOnly(2026, 8, 23));
    }

    private static ClientMembership AddMembership(
        GymCrmDbContext db,
        Guid clientId,
        Guid groupId,
        Guid branchId,
        MembershipBehaviorKind behaviorKind,
        DateOnly? validFrom,
        DateOnly? validTo,
        bool addTarget = true)
    {
        var now = DateTimeOffset.UtcNow;
        var sale = new ClientMembershipSale
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            BehaviorKind = behaviorKind,
            PricingMode = ClientMembershipSalePricingMode.AmountOnly,
            PurchaseDate = validFrom ?? new DateOnly(2026, 8, 23),
            PaymentDate = validFrom ?? new DateOnly(2026, 8, 23),
            GrossAmount = behaviorKind == MembershipBehaviorKind.Professional ? 0m : 100m,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = now
        };
        var membership = new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = sale.Id,
            Sale = sale,
            BehaviorKind = behaviorKind,
            IndividualValidFrom = validFrom,
            IndividualValidTo = validTo,
            ProfessionalComment = behaviorKind == MembershipBehaviorKind.Professional ? "Professional" : null,
            ChangeReason = ClientMembershipChangeReason.NewPurchase,
            ChangedByUserId = Guid.NewGuid(),
            ValidFrom = now,
            CreatedAt = now
        };
        if (addTarget)
        {
            membership.TargetGroups.Add(new ClientMembershipTargetGroup
            {
                ClientMembershipId = membership.Id,
                GroupId = groupId,
                BranchId = branchId,
                Position = 0
            });
        }

        db.ClientMembershipSales.Add(sale);
        db.ClientMemberships.Add(membership);
        db.SaveChanges();
        return membership;
    }

    private sealed record ResolverSeed(Guid ClientId, Guid BranchId, Guid GroupAId, Guid GroupBId, DateOnly Today);
}
