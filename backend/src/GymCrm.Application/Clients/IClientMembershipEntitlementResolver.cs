using GymCrm.Domain.Memberships;

namespace GymCrm.Application.Clients;

public interface IClientMembershipEntitlementResolver
{
    Task<ClientMembershipEntitlementResolution> ResolveAsync(
        Guid clientId,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken);
}

public sealed record ClientMembershipEntitlementResolution(
    ClientMembershipEntitlementResolutionStatus Status,
    Guid ClientId,
    Guid GroupId,
    DateOnly TrainingDate,
    Guid? MembershipId,
    Guid? SaleId,
    MembershipBehaviorKind? BehaviorKind,
    MembershipCoverageKind? CoverageKind,
    IReadOnlyList<ClientMembershipTargetSnapshotResult> TargetGroups)
{
    public static ClientMembershipEntitlementResolution NoEntitlement(Guid clientId, Guid groupId, DateOnly trainingDate) =>
        new(
            ClientMembershipEntitlementResolutionStatus.NoEntitlement,
            clientId,
            groupId,
            trainingDate,
            null,
            null,
            null,
            null,
            []);

    public static ClientMembershipEntitlementResolution InvariantConflict(Guid clientId, Guid groupId, DateOnly trainingDate) =>
        new(
            ClientMembershipEntitlementResolutionStatus.InvariantConflict,
            clientId,
            groupId,
            trainingDate,
            null,
            null,
            null,
            null,
            []);
}

public enum ClientMembershipEntitlementResolutionStatus
{
    NoEntitlement = 0,
    Found = 1,
    InvariantConflict = 2
}
