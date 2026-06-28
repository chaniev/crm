using GymCrm.Domain.Clients;

namespace GymCrm.Application.Clients;

public static class ClientMembershipSemantics
{
    public static DateOnly? CalculateDefaultExpirationDate(MembershipType membershipType, DateOnly startDate)
    {
        return membershipType switch
        {
            MembershipType.SingleVisit => null,
            MembershipType.Monthly => startDate.AddMonths(1).AddDays(-1),
            MembershipType.Yearly => startDate.AddYears(1).AddDays(-1),
            _ => null
        };
    }

    public static DateOnly? ExtendExpirationDate(MembershipType membershipType, DateOnly currentExpirationDate)
    {
        return membershipType switch
        {
            MembershipType.SingleVisit => null,
            MembershipType.Monthly => currentExpirationDate.AddMonths(1),
            MembershipType.Yearly => currentExpirationDate.AddYears(1),
            _ => null
        };
    }

    public static bool HasActivePaidMembership(
        bool isProfessional,
        ClientMembership? membership,
        DateOnly referenceDate,
        bool requirePurchaseDateReached = false)
    {
        if (isProfessional)
        {
            return true;
        }

        if (membership is null || !membership.IsPaid)
        {
            return false;
        }

        if (requirePurchaseDateReached && membership.PurchaseDate > referenceDate)
        {
            return false;
        }

        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < referenceDate)
        {
            return false;
        }

        return membership.MembershipType != MembershipType.SingleVisit || !membership.SingleVisitUsed;
    }

    public static bool HasUnpaidCurrentMembership(
        bool isProfessional,
        ClientMembership? membership)
    {
        return !isProfessional && membership is not null && !membership.IsPaid;
    }

    public static IReadOnlyList<ClientMembershipIssue> EvaluateIssues(
        bool isProfessional,
        ClientMembership? membership,
        DateOnly trainingDate)
    {
        if (isProfessional)
        {
            return [];
        }

        if (membership is null)
        {
            return [ClientMembershipIssue.NoCurrentMembership];
        }

        var issues = new List<ClientMembershipIssue>();
        if (membership.PurchaseDate > trainingDate)
        {
            issues.Add(ClientMembershipIssue.PurchasedAfterTrainingDate);
        }

        if (!membership.IsPaid)
        {
            issues.Add(ClientMembershipIssue.Unpaid);
        }

        if (membership.MembershipType == MembershipType.SingleVisit && membership.SingleVisitUsed)
        {
            issues.Add(ClientMembershipIssue.SingleVisitAlreadyUsed);
        }

        if (membership.ExpirationDate.HasValue && membership.ExpirationDate.Value < trainingDate)
        {
            issues.Add(ClientMembershipIssue.Expired);
        }

        return issues;
    }
}

public enum ClientMembershipIssue
{
    NoCurrentMembership = 0,
    PurchasedAfterTrainingDate = 1,
    Unpaid = 2,
    SingleVisitAlreadyUsed = 3,
    Expired = 4
}
