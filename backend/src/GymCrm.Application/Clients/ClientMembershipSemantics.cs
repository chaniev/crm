using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public static class ClientMembershipSemantics
{
    public static DateOnly? CalculateDefaultExpirationDate(MembershipBehaviorKind behaviorKind, DateOnly startDate)
    {
        return behaviorKind switch
        {
            MembershipBehaviorKind.SingleVisit => null,
            MembershipBehaviorKind.Term => startDate.AddMonths(1).AddDays(-1),
            _ => null
        };
    }

    public static DateOnly? ExtendExpirationDate(MembershipBehaviorKind behaviorKind, DateOnly currentExpirationDate)
    {
        return behaviorKind switch
        {
            MembershipBehaviorKind.SingleVisit => null,
            MembershipBehaviorKind.Term => currentExpirationDate.AddMonths(1),
            _ => null
        };
    }

    public static bool HasActivePaidMembership(
        bool isProfessional,
        ClientMembership? membership,
        DateOnly referenceDate,
        bool requirePurchaseDateReached = false)
    {
        if (membership?.BehaviorKind == MembershipBehaviorKind.Professional && IsEffective(membership, referenceDate))
        {
            return true;
        }

        if (membership is null || !membership.IsPaid)
        {
            return false;
        }

        if (requirePurchaseDateReached && membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value > referenceDate)
        {
            return false;
        }

        if (membership.IndividualValidTo.HasValue && membership.IndividualValidTo.Value < referenceDate)
        {
            return false;
        }

        return membership.BehaviorKind != MembershipBehaviorKind.SingleVisit || !membership.SingleVisitUsed;
    }

    public static bool HasUnpaidCurrentMembership(
        bool isProfessional,
        ClientMembership? membership)
    {
        return membership is not null && membership.BehaviorKind != MembershipBehaviorKind.Professional && !membership.IsPaid;
    }

    public static IReadOnlyList<ClientMembershipIssue> EvaluateIssues(
        bool isProfessional,
        ClientMembership? membership,
        DateOnly trainingDate)
    {
        if (membership?.BehaviorKind == MembershipBehaviorKind.Professional && IsEffective(membership, trainingDate))
        {
            return [];
        }

        if (membership is null)
        {
            return [ClientMembershipIssue.NoCurrentMembership];
        }

        var issues = new List<ClientMembershipIssue>();
        if (membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value > trainingDate)
        {
            issues.Add(ClientMembershipIssue.PurchasedAfterTrainingDate);
        }

        if (!membership.IsPaid)
        {
            issues.Add(ClientMembershipIssue.Unpaid);
        }

        if (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit && membership.SingleVisitUsed)
        {
            issues.Add(ClientMembershipIssue.SingleVisitAlreadyUsed);
        }

        if (membership.IndividualValidTo.HasValue && membership.IndividualValidTo.Value < trainingDate)
        {
            issues.Add(ClientMembershipIssue.Expired);
        }

        return issues;
    }

    private static bool IsEffective(ClientMembership membership, DateOnly date) =>
        membership.IndividualValidFrom.HasValue && membership.IndividualValidFrom.Value <= date &&
        (membership.IndividualValidTo is null || membership.IndividualValidTo >= date);
}

public enum ClientMembershipIssue
{
    NoCurrentMembership = 0,
    PurchasedAfterTrainingDate = 1,
    Unpaid = 2,
    SingleVisitAlreadyUsed = 3,
    Expired = 4
}
