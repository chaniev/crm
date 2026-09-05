using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public static class ClientMembershipTargetPolicy
{
    public const int MaxTargetCount = 5;

    public static MembershipCoverageKind ResolveCoverageKind(MembershipBehaviorKind behaviorKind) =>
        behaviorKind == MembershipBehaviorKind.Professional
            ? MembershipCoverageKind.AllGroups
            : MembershipCoverageKind.TargetGroups;

    public static ClientMembershipEntitlementState ResolveEntitlementState(
        ClientMembership membership,
        DateOnly referenceDate)
    {
        if (membership.ValidTo is not null)
        {
            return ClientMembershipEntitlementState.Expired;
        }

        if (membership.TargetGroups.Count == 0)
        {
            return ClientMembershipEntitlementState.LegacyTargetMissing;
        }

        if (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit && membership.SingleVisitUsed)
        {
            return ClientMembershipEntitlementState.UsedSingleVisit;
        }

        if (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit)
        {
            return ClientMembershipEntitlementState.Active;
        }

        if (!membership.IndividualValidFrom.HasValue)
        {
            return ClientMembershipEntitlementState.Expired;
        }

        if (membership.IndividualValidFrom.Value > referenceDate)
        {
            return ClientMembershipEntitlementState.Future;
        }

        if (membership.IndividualValidTo.HasValue && membership.IndividualValidTo.Value < referenceDate)
        {
            return ClientMembershipEntitlementState.Expired;
        }

        return ClientMembershipEntitlementState.Active;
    }

    public static ClientMembershipTargetValidationResult ValidateTargets(
        MembershipBehaviorKind behaviorKind,
        IReadOnlyList<ClientMembershipTargetDescriptor> targets)
    {
        if (targets.Count == 0)
        {
            return ClientMembershipTargetValidationResult.Invalid("targetGroupIds", global::GymCrm.Application.UserFacingText.ClientMembershipText.ClientMembershipTargetPolicyLine63e59186fa);
        }

        if (targets.Count > MaxTargetCount)
        {
            return ClientMembershipTargetValidationResult.Invalid("targetGroupIds", global::GymCrm.Application.UserFacingText.ClientMembershipText.ClientMembershipTargetPolicyLine686a88c317);
        }

        if (behaviorKind == MembershipBehaviorKind.SingleVisit && targets.Count != 1)
        {
            return ClientMembershipTargetValidationResult.Invalid("targetGroupIds", global::GymCrm.Application.UserFacingText.ClientMembershipText.ClientMembershipTargetPolicyLine73def85203);
        }

        var duplicate = targets
            .GroupBy(target => target.GroupId)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            var position = FindIndex(targets, target => target.GroupId == duplicate.Key);
            return ClientMembershipTargetValidationResult.Invalid(
                position >= 0 ? $"targetGroupIds[{position}]" : "targetGroupIds",
                global::GymCrm.Application.UserFacingText.ClientMembershipText.ClientMembershipTargetPolicyLine84fec81fab);
        }

        var branchId = targets[0].BranchId;
        var crossBranchIndex = FindIndex(targets, target => target.BranchId != branchId);
        if (crossBranchIndex >= 0)
        {
            return ClientMembershipTargetValidationResult.Invalid(
                $"targetGroupIds[{crossBranchIndex}]",
                global::GymCrm.Application.UserFacingText.ClientMembershipText.ClientMembershipTargetPolicyLine93ff3ce397);
        }

        return ClientMembershipTargetValidationResult.Valid();
    }

    private static int FindIndex<T>(IReadOnlyList<T> items, Predicate<T> predicate)
    {
        for (var index = 0; index < items.Count; index++)
        {
            if (predicate(items[index]))
            {
                return index;
            }
        }

        return -1;
    }

    public static bool EffectivePeriodsOverlap(
        MembershipBehaviorKind existingKind,
        DateOnly? existingFrom,
        DateOnly? existingTo,
        bool existingSingleVisitUsed,
        MembershipBehaviorKind requestedKind,
        DateOnly? requestedFrom,
        DateOnly? requestedTo)
    {
        var existingPeriod = ResolveEffectivePeriod(existingKind, existingFrom, existingTo, existingSingleVisitUsed);
        var requestedPeriod = ResolveEffectivePeriod(requestedKind, requestedFrom, requestedTo, singleVisitUsed: false);
        if (existingPeriod is null || requestedPeriod is null)
        {
            return false;
        }

        return existingPeriod.Value.From <= requestedPeriod.Value.To &&
               requestedPeriod.Value.From <= existingPeriod.Value.To;
    }

    public static bool TargetSetsOverlap(
        MembershipBehaviorKind existingKind,
        IReadOnlyCollection<Guid> existingTargets,
        MembershipBehaviorKind requestedKind,
        IReadOnlyCollection<Guid> requestedTargets)
    {
        if (existingTargets.Count == 0 || requestedTargets.Count == 0)
        {
            return false;
        }

        if (existingKind == MembershipBehaviorKind.Professional ||
            requestedKind == MembershipBehaviorKind.Professional)
        {
            return true;
        }

        return existingTargets.Intersect(requestedTargets).Any();
    }

    public static bool MembershipCoversGroup(ClientMembership membership, Guid groupId, DateOnly trainingDate)
    {
        var state = ResolveEntitlementState(membership, trainingDate);
        if (state != ClientMembershipEntitlementState.Active)
        {
            return false;
        }

        return membership.BehaviorKind == MembershipBehaviorKind.Professional ||
               membership.TargetGroups.Any(target => target.GroupId == groupId);
    }

    private static (DateOnly From, DateOnly To)? ResolveEffectivePeriod(
        MembershipBehaviorKind kind,
        DateOnly? from,
        DateOnly? to,
        bool singleVisitUsed)
    {
        if (kind == MembershipBehaviorKind.SingleVisit)
        {
            return singleVisitUsed ? null : (from ?? DateOnly.MinValue, DateOnly.MaxValue);
        }

        if (!from.HasValue)
        {
            return null;
        }

        return (from.Value, to ?? DateOnly.MaxValue);
    }
}

public sealed record ClientMembershipTargetDescriptor(Guid GroupId, Guid BranchId, string GroupName, string BranchName, bool IsActive);

public sealed record ClientMembershipTargetSnapshotResult(
    Guid GroupId,
    string GroupName,
    Guid BranchId,
    string BranchName,
    int Position,
    bool IsActive);

public enum ClientMembershipEntitlementState
{
    Active = 0,
    Future = 1,
    Expired = 2,
    UsedSingleVisit = 3,
    LegacyTargetMissing = 4
}

public readonly record struct ClientMembershipTargetValidationResult(
    bool Succeeded,
    string? Field,
    string? Message)
{
    public static ClientMembershipTargetValidationResult Valid() => new(true, null, null);

    public static ClientMembershipTargetValidationResult Invalid(string field, string message) => new(false, field, message);
}
