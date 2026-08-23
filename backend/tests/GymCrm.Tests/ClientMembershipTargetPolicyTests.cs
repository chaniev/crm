using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Tests;

public sealed class ClientMembershipTargetPolicyTests
{
    [Fact]
    public void Target_validation_preserves_order_and_rejects_duplicate_too_many_and_cross_branch_sets()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        var targets = Enumerable.Range(0, 5)
            .Select(index => new ClientMembershipTargetDescriptor(Guid.NewGuid(), branchA, $"Group {index}", "Branch A", true))
            .ToArray();

        Assert.True(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.Term, targets).Succeeded);
        Assert.True(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.Professional, targets).Succeeded);
        Assert.True(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.SingleVisit, [targets[0]]).Succeeded);

        Assert.False(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.SingleVisit, targets[..2]).Succeeded);
        Assert.False(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.Term, targets.Append(
            new ClientMembershipTargetDescriptor(Guid.NewGuid(), branchA, "Sixth", "Branch A", true)).ToArray()).Succeeded);
        Assert.False(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.Term, [targets[0], targets[0]]).Succeeded);
        Assert.False(ClientMembershipTargetPolicy.ValidateTargets(MembershipBehaviorKind.Term, [
            targets[0],
            new ClientMembershipTargetDescriptor(Guid.NewGuid(), branchB, "Other", "Branch B", true)
        ]).Succeeded);
    }

    [Fact]
    public void Overlap_matrix_allows_disjoint_targets_and_blocks_intersection_or_professional()
    {
        var groupA = Guid.NewGuid();
        var groupB = Guid.NewGuid();
        var groupC = Guid.NewGuid();
        var today = new DateOnly(2026, 8, 23);

        Assert.True(ClientMembershipTargetPolicy.EffectivePeriodsOverlap(
            MembershipBehaviorKind.Term,
            today,
            today.AddDays(10),
            existingSingleVisitUsed: false,
            MembershipBehaviorKind.Term,
            today.AddDays(10),
            today.AddDays(20)));
        Assert.False(ClientMembershipTargetPolicy.TargetSetsOverlap(
            MembershipBehaviorKind.Term,
            [groupA, groupB],
            MembershipBehaviorKind.Term,
            [groupC]));
        Assert.True(ClientMembershipTargetPolicy.TargetSetsOverlap(
            MembershipBehaviorKind.Term,
            [groupA, groupB],
            MembershipBehaviorKind.SingleVisit,
            [groupB]));
        Assert.True(ClientMembershipTargetPolicy.TargetSetsOverlap(
            MembershipBehaviorKind.Professional,
            [groupA],
            MembershipBehaviorKind.Term,
            [groupC]));
    }

    [Fact]
    public void Resolver_excludes_closed_used_expired_and_legacy_empty_memberships()
    {
        var groupId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var active = CreateMembership(groupId, branchId, MembershipBehaviorKind.Term, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));
        var closed = CreateMembership(groupId, branchId, MembershipBehaviorKind.Term, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));
        closed.ValidTo = DateTimeOffset.UtcNow;
        var usedSingleVisit = CreateMembership(groupId, branchId, MembershipBehaviorKind.SingleVisit, null, null);
        usedSingleVisit.SingleVisitUsed = true;
        var legacyEmpty = CreateMembership(groupId, branchId, MembershipBehaviorKind.Term, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));
        legacyEmpty.TargetGroups.Clear();

        Assert.True(ClientMembershipTargetPolicy.MembershipCoversGroup(active, groupId, new DateOnly(2026, 8, 23)));
        Assert.False(ClientMembershipTargetPolicy.MembershipCoversGroup(closed, groupId, new DateOnly(2026, 8, 23)));
        Assert.False(ClientMembershipTargetPolicy.MembershipCoversGroup(usedSingleVisit, groupId, new DateOnly(2026, 8, 23)));
        Assert.False(ClientMembershipTargetPolicy.MembershipCoversGroup(legacyEmpty, groupId, new DateOnly(2026, 8, 23)));
    }

    private static ClientMembership CreateMembership(
        Guid groupId,
        Guid branchId,
        MembershipBehaviorKind behaviorKind,
        DateOnly? validFrom,
        DateOnly? validTo)
    {
        var membership = new ClientMembership
        {
            Id = Guid.NewGuid(),
            BehaviorKind = behaviorKind,
            IndividualValidFrom = validFrom,
            IndividualValidTo = validTo,
            ValidFrom = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };
        membership.TargetGroups.Add(new ClientMembershipTargetGroup
        {
            ClientMembershipId = membership.Id,
            GroupId = groupId,
            BranchId = branchId,
            Position = 0
        });
        return membership;
    }
}
