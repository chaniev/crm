using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipVisitService(
    GymCrmDbContext dbContext,
    TimeProvider timeProvider,
    ClientMembershipDetailsReader detailsReader,
    ClientMembershipQueryStore queryStore,
    IClientMembershipEntitlementResolver entitlementResolver)
{
    public async Task<SingleVisitWriteOffResult> WriteOffSingleVisitAsync(
        Guid clientId,
        WriteOffSingleVisitCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.TrainingDate == default ||
            command.GroupId == Guid.Empty)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.ClientMissing);
        }

        var entitlement = await entitlementResolver.ResolveAsync(clientId, command.GroupId, command.TrainingDate, cancellationToken);
        if (entitlement.Status == ClientMembershipEntitlementResolutionStatus.InvariantConflict)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.MembershipEntitlementInvariantConflict);
        }

        if (entitlement.Status == ClientMembershipEntitlementResolutionStatus.NoEntitlement ||
            !entitlement.MembershipId.HasValue)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.CurrentMembershipMissing);
        }

        var currentMembership = await dbContext.ClientMemberships
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CreatedByUser)
            .Include(membership => membership.TargetGroups)
                .ThenInclude(target => target.Group)
                    .ThenInclude(group => group.Branch)
            .SingleAsync(membership => membership.Id == entitlement.MembershipId.Value, cancellationToken);

        if (currentMembership.BehaviorKind != MembershipBehaviorKind.SingleVisit)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.MembershipNotSingleVisit);
        }

        if (currentMembership.SingleVisitUsed)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.SingleVisitAlreadyUsed);
        }

        if (currentMembership.Sale.PurchaseDate > command.TrainingDate)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.MembershipPurchasedAfterTrainingDate);
        }

        var previousMembership = ClientMembershipDetailsReader.MapMembershipSnapshot(currentMembership);
        var now = timeProvider.GetUtcNow();
        var writtenOffMembership = ClientMembershipMutationRules.CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                true,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitWriteOff,
                command.ChangedByUserId,
                now,
                MapTargetDescriptors(currentMembership.TargetGroups));
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            writtenOffMembership,
            now,
            cancellationToken);

        var currentMembershipSnapshot = (await detailsReader.LoadRequiredForMembershipAsync(
                clientId,
                writtenOffMembership.Id,
                cancellationToken)).CurrentMembership
            ?? throw new InvalidOperationException($"Current membership for client '{clientId}' was not found after single-visit write-off.");

        return SingleVisitWriteOffResult.Success(previousMembership, currentMembershipSnapshot);
    }

    public async Task<SingleVisitRestoreResult> RestoreSingleVisitAsync(
        Guid clientId,
        RestoreSingleVisitCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.ExpectedSaleId == Guid.Empty ||
            command.ExpectedWriteOffMembershipId == Guid.Empty)
        {
            return SingleVisitRestoreResult.Failure(SingleVisitRestoreStatus.InvalidRequest);
        }

        var currentMembership = await queryStore.LoadAddressedCurrentMembershipAsync(
            clientId,
            command.ExpectedSaleId,
            command.ExpectedWriteOffMembershipId,
            cancellationToken);
        if (currentMembership is null ||
            currentMembership.BehaviorKind != MembershipBehaviorKind.SingleVisit ||
            !currentMembership.SingleVisitUsed ||
            currentMembership.ChangeReason != ClientMembershipChangeReason.SingleVisitWriteOff)
        {
            return SingleVisitRestoreResult.Failure(SingleVisitRestoreStatus.Conflict);
        }

        var previousMembership = ClientMembershipDetailsReader.MapMembershipSnapshot(currentMembership);
        var now = timeProvider.GetUtcNow();
        var targets = MapTargetDescriptors(currentMembership.TargetGroups);
        if (await queryStore.HasConflictingMembershipAsync(
                clientId,
                MembershipBehaviorKind.SingleVisit,
                currentMembership.Sale.PurchaseDate,
                validTo: null,
                targets.Select(target => target.GroupId).ToArray(),
                currentMembership.Id,
                cancellationToken))
        {
            return SingleVisitRestoreResult.Failure(SingleVisitRestoreStatus.Conflict);
        }

        var nextMembership = ClientMembershipMutationRules.CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                false,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitRestore,
                command.ChangedByUserId,
                now,
                targets);
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            nextMembership,
            now,
            cancellationToken);

        var restoredMembership = (await detailsReader.LoadRequiredForMembershipAsync(
                clientId,
                nextMembership.Id,
                cancellationToken)).CurrentMembership
            ?? throw new InvalidOperationException($"Current membership for client '{clientId}' was not found after single-visit restore.");

        return SingleVisitRestoreResult.Success(previousMembership, restoredMembership);
    }

    private static IReadOnlyList<ClientMembershipTargetDescriptor> MapTargetDescriptors(
        IEnumerable<ClientMembershipTargetGroup> targets)
    {
        return targets
            .OrderBy(target => target.Position)
            .Select(target => new ClientMembershipTargetDescriptor(
                target.GroupId,
                target.BranchId,
                target.Group.Name,
                target.Group.Branch.Name,
                target.Group.IsActive))
            .ToArray();
    }

    private async Task ReplaceCurrentMembershipAsync(
        ClientMembership currentMembership,
        ClientMembership nextMembership,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);

        try
        {
            await queryStore.ReplaceCurrentMembershipAsync(currentMembership, nextMembership, now, cancellationToken);
            await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);
        }
        catch
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            throw;
        }
    }
}
