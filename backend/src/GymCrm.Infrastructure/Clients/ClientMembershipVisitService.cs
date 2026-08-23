using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Infrastructure.Persistence;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipVisitService(
    GymCrmDbContext dbContext,
    TimeProvider timeProvider,
    ClientMembershipDetailsReader detailsReader,
    ClientMembershipQueryStore queryStore)
{
    public async Task<SingleVisitWriteOffResult> WriteOffSingleVisitAsync(
        Guid clientId,
        WriteOffSingleVisitCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.TrainingDate == default)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.ClientMissing);
        }

        var currentMembership = await queryStore.LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.CurrentMembershipMissing);
        }

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
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            ClientMembershipMutationRules.CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                true,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitWriteOff,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        var currentMembershipSnapshot = (await detailsReader.LoadRequiredAsync(clientId, cancellationToken)).CurrentMembership
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

        var currentMembership = await queryStore.LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null ||
            currentMembership.Id != command.ExpectedWriteOffMembershipId ||
            currentMembership.SaleId != command.ExpectedSaleId ||
            currentMembership.BehaviorKind != MembershipBehaviorKind.SingleVisit ||
            !currentMembership.SingleVisitUsed ||
            currentMembership.ChangeReason != ClientMembershipChangeReason.SingleVisitWriteOff)
        {
            return SingleVisitRestoreResult.Failure(SingleVisitRestoreStatus.Conflict);
        }

        var previousMembership = ClientMembershipDetailsReader.MapMembershipSnapshot(currentMembership);
        var now = timeProvider.GetUtcNow();
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            ClientMembershipMutationRules.CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                false,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitRestore,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        var restoredMembership = (await detailsReader.LoadRequiredAsync(clientId, cancellationToken)).CurrentMembership
            ?? throw new InvalidOperationException($"Current membership for client '{clientId}' was not found after single-visit restore.");

        return SingleVisitRestoreResult.Success(previousMembership, restoredMembership);
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
