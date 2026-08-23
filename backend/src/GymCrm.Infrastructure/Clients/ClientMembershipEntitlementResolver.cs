using GymCrm.Application.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipEntitlementResolver(
    GymCrmDbContext dbContext,
    ILogger<ClientMembershipEntitlementResolver> logger) : IClientMembershipEntitlementResolver
{
    public async Task<ClientMembershipEntitlementResolution> ResolveAsync(
        Guid clientId,
        Guid groupId,
        DateOnly trainingDate,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty || groupId == Guid.Empty || trainingDate == default)
        {
            return ClientMembershipEntitlementResolution.NoEntitlement(clientId, groupId, trainingDate);
        }

        var candidates = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .Where(membership => membership.ClientId == clientId && membership.ValidTo == null)
            .ToArrayAsync(cancellationToken);

        var matches = candidates
            .Where(membership => ClientMembershipTargetPolicy.MembershipCoversGroup(membership, groupId, trainingDate))
            .OrderByDescending(membership => membership.BehaviorKind == MembershipBehaviorKind.Professional)
            .ThenByDescending(membership => membership.CreatedAt)
            .ThenByDescending(membership => membership.Id)
            .ToArray();

        if (matches.Length == 0)
        {
            return ClientMembershipEntitlementResolution.NoEntitlement(clientId, groupId, trainingDate);
        }

        if (matches.Length > 1)
        {
            logger.LogError(
                "Multiple membership entitlements matched client {ClientId}, group {GroupId}, training date {TrainingDate}. MembershipIds: {MembershipIds}",
                clientId,
                groupId,
                trainingDate,
                matches.Select(membership => membership.Id).ToArray());
            return ClientMembershipEntitlementResolution.InvariantConflict(clientId, groupId, trainingDate);
        }

        var match = matches[0];
        var coverageKind = ClientMembershipTargetPolicy.ResolveCoverageKind(match.BehaviorKind);
        return new ClientMembershipEntitlementResolution(
            ClientMembershipEntitlementResolutionStatus.Found,
            clientId,
            groupId,
            trainingDate,
            match.Id,
            match.SaleId,
            match.BehaviorKind,
            coverageKind,
            match.TargetGroups
                .OrderBy(target => target.Position)
                .Select(target => new ClientMembershipTargetSnapshotResult(
                    target.GroupId,
                    target.Group.Name,
                    target.BranchId,
                    target.Group.Branch.Name,
                    target.Position,
                    target.Group.IsActive))
                .ToArray());
    }
}
