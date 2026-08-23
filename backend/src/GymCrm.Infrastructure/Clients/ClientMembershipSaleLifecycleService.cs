using GymCrm.Application.Attendance;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipSaleLifecycleService(
    GymCrmDbContext dbContext,
    TimeProvider timeProvider,
    IBusinessDateProvider businessDateProvider,
    ClientMembershipDetailsReader detailsReader,
    ClientMembershipQueryStore queryStore)
{
    public async Task<ClientMembershipMutationResult> PurchaseAsync(
        Guid clientId,
        CreateClientMembershipPurchaseCommand command,
        CancellationToken cancellationToken)
    {
        var today = businessDateProvider.Today;
        if (!ClientMembershipMutationRules.IsValidSaleCommand(clientId, command.ChangedByUserId, command.PaymentDate, today))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        var client = await dbContext.Clients.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == clientId, cancellationToken);
        if (client is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var item = await LoadCatalogItemAsync(command.MembershipCatalogItemId, cancellationToken);
        var itemError = command.MembershipCatalogItemId.HasValue
            ? ClientMembershipMutationRules.ValidateCatalogItem(item, client.BranchId, today)
            : ClientMembershipMutationError.None;
        if (itemError != ClientMembershipMutationError.None)
        {
            return ClientMembershipMutationResult.Failure(itemError);
        }

        var pricing = ClientMembershipSalePricingPolicy.Resolve(item, command.ManualSaleAmount);
        if (!pricing.Succeeded)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationRules.MapPricingError(pricing.Error));
        }

        var resolution = pricing.Resolution!;
        if (resolution.BehaviorKind == MembershipBehaviorKind.Professional &&
            !await queryStore.ActorHasRoleAsync(command.ChangedByUserId, UserRole.HeadCoach, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ProfessionalPermissionDenied);
        }

        if (!ClientMembershipMutationRules.ValidateValidity(
                resolution.BehaviorKind,
                command.ValidFrom,
                command.ValidTo,
                command.ProfessionalComment))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipValidityInvalid);
        }

        if (await queryStore.HasConflictingMembershipAsync(
                clientId,
                resolution.BehaviorKind,
                command.ValidFrom,
                command.ValidTo,
                exceptMembershipId: null,
                cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipOverlap);
        }

        if (await queryStore.HasActiveMembershipAsync(clientId, today, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ActiveMembershipExists);
        }

        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var sale = ClientMembershipMutationRules.CreateSale(
            clientId,
            item,
            resolution,
            today,
            command.PaymentDate,
            command.ChangedByUserId,
            now);
        dbContext.ClientMembershipSales.Add(sale);
        dbContext.ClientMemberships.Add(ClientMembershipMutationRules.CreateMembership(
            clientId,
            sale,
            command.ValidFrom,
            command.ValidTo,
            false,
            command.ProfessionalComment,
            ClientMembershipChangeReason.NewPurchase,
            command.ChangedByUserId,
            now));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);
        }
        catch (DbUpdateException exception) when (ClientMembershipTransaction.IsMembershipOverlapException(exception))
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipOverlap);
        }

        return ClientMembershipMutationResult.Success(await detailsReader.LoadRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipCommentMutationResult> UpdateCommentAsync(
        Guid clientId,
        Guid saleId,
        UpdateClientMembershipCommentCommand command,
        CancellationToken cancellationToken)
    {
        var sale = await dbContext.ClientMembershipSales
            .SingleOrDefaultAsync(candidate => candidate.Id == saleId && candidate.ClientId == clientId, cancellationToken);
        if (sale is null)
        {
            return ClientMembershipCommentMutationResult.Missing();
        }

        var transition = ClientMembershipCommentPolicy.Apply(
            sale,
            command.Comment,
            command.ChangedByUserId,
            timeProvider.GetUtcNow());
        if (transition is not null)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return ClientMembershipCommentMutationResult.Success(
            transition,
            await detailsReader.LoadRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        var today = businessDateProvider.Today;
        if (!ClientMembershipMutationRules.IsValidSaleCommand(clientId, command.ChangedByUserId, command.PaymentDate, today))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var currentMembership = await queryStore.LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CurrentMembershipMissing);
        }

        if (currentMembership.BehaviorKind is MembershipBehaviorKind.SingleVisit || currentMembership.IndividualValidTo is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.RenewalNotAllowed);
        }

        var clientBranchId = await dbContext.Clients
            .Where(client => client.Id == clientId)
            .Select(client => client.BranchId)
            .SingleAsync(cancellationToken);
        var item = await LoadCatalogItemAsync(command.MembershipCatalogItemId, cancellationToken);
        var itemError = command.MembershipCatalogItemId.HasValue
            ? ClientMembershipMutationRules.ValidateCatalogItem(item, clientBranchId, today)
            : ClientMembershipMutationError.None;
        if (itemError != ClientMembershipMutationError.None)
        {
            return ClientMembershipMutationResult.Failure(itemError);
        }

        var pricing = ClientMembershipSalePricingPolicy.Resolve(item, command.ManualSaleAmount);
        if (!pricing.Succeeded)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationRules.MapPricingError(pricing.Error));
        }

        var resolution = pricing.Resolution!;
        if (resolution.BehaviorKind != currentMembership.BehaviorKind)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipValidityInvalid);
        }

        if (resolution.BehaviorKind == MembershipBehaviorKind.Professional &&
            !await queryStore.ActorHasRoleAsync(command.ChangedByUserId, UserRole.HeadCoach, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ProfessionalPermissionDenied);
        }

        var lastEnd = await dbContext.ClientMemberships
            .Where(membership => membership.ClientId == clientId && membership.IndividualValidTo != null)
            .MaxAsync(membership => membership.IndividualValidTo, cancellationToken);
        if (lastEnd is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.RenewalNotAllowed);
        }

        var validFrom = lastEnd.Value.AddDays(1);
        var duration = currentMembership.IndividualValidTo.Value.DayNumber -
                       currentMembership.IndividualValidFrom!.Value.DayNumber;
        var validTo = validFrom.AddDays(duration);
        if (await queryStore.HasConflictingMembershipAsync(
                clientId,
                resolution.BehaviorKind,
                validFrom,
                validTo,
                exceptMembershipId: null,
                cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipOverlap);
        }

        await using var transaction = await ClientMembershipTransaction.BeginIfSupportedAsync(dbContext, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var sale = ClientMembershipMutationRules.CreateSale(
            clientId,
            item,
            resolution,
            today,
            command.PaymentDate,
            command.ChangedByUserId,
            now);
        dbContext.ClientMembershipSales.Add(sale);
        dbContext.ClientMemberships.Add(ClientMembershipMutationRules.CreateMembership(
            clientId,
            sale,
            validFrom,
            validTo,
            false,
            command.ProfessionalComment,
            ClientMembershipChangeReason.Renewal,
            command.ChangedByUserId,
            now));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await ClientMembershipTransaction.CommitIfPresentAsync(transaction, cancellationToken);
        }
        catch (DbUpdateException exception) when (ClientMembershipTransaction.IsMembershipOverlapException(exception))
        {
            await ClientMembershipTransaction.RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipOverlap);
        }

        return ClientMembershipMutationResult.Success(await detailsReader.LoadRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        var today = businessDateProvider.Today;
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.SaleId == Guid.Empty ||
            command.ExpectedMembershipId == Guid.Empty ||
            ClientMembershipPaymentDatePolicy.Validate(command.PaymentDate, today) !=
            ClientMembershipPaymentDateValidationResult.Valid)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (command.ValidFrom.HasValue && command.ValidTo.HasValue && command.ValidTo.Value < command.ValidFrom.Value)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (!await queryStore.ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var target = await queryStore.LoadAddressedMembershipAsync(
            clientId,
            command.SaleId,
            command.ExpectedMembershipId,
            cancellationToken);
        if (target.Status != AddressedMembershipStatus.Found)
        {
            return ClientMembershipMutationResult.Failure(
                ClientMembershipMutationRules.MapAddressedMembershipStatus(target.Status));
        }

        var currentMembership = target.Membership!;
        var currentSale = currentMembership.Sale;
        var oldSale = ClientMembershipDetailsReader.MapSaleSnapshot(currentSale);
        var now = timeProvider.GetUtcNow();
        var nextValidFrom = currentMembership.BehaviorKind == MembershipBehaviorKind.SingleVisit ? null : command.ValidFrom;
        var nextValidTo = currentMembership.BehaviorKind == MembershipBehaviorKind.SingleVisit ? null : command.ValidTo;

        if (!ClientMembershipMutationRules.ValidateValidity(
                currentMembership.BehaviorKind,
                nextValidFrom,
                nextValidTo,
                currentMembership.ProfessionalComment))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipValidityInvalid);
        }

        if (await queryStore.HasConflictingMembershipAsync(
                clientId,
                currentMembership.BehaviorKind,
                nextValidFrom,
                nextValidTo,
                currentMembership.Id,
                cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipOverlap);
        }

        if (currentSale.Refunds.Any(refund => refund.CanceledAt is null && refund.RefundDate < command.PaymentDate))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund);
        }

        var correctedMembership = ClientMembershipMutationRules.CreateMembership(
            clientId,
            currentSale,
            nextValidFrom,
            nextValidTo,
            currentMembership.SingleVisitUsed,
            currentMembership.ProfessionalComment,
            ClientMembershipChangeReason.Correction,
            command.ChangedByUserId,
            now);
        currentSale.PaymentDate = command.PaymentDate;

        await ReplaceCurrentMembershipAsync(currentMembership, correctedMembership, now, cancellationToken);

        var newSale = ClientMembershipDetailsReader.MapSaleSnapshot(currentSale);
        var saleAudit = oldSale.PaymentDate == newSale.PaymentDate
            ? null
            : new ClientMembershipSaleAuditResult(oldSale, newSale);

        return ClientMembershipMutationResult.Success(
            await detailsReader.LoadRequiredAsync(clientId, cancellationToken),
            saleAudit);
    }

    private async Task<MembershipCatalogItem?> LoadCatalogItemAsync(
        Guid? catalogItemId,
        CancellationToken cancellationToken)
    {
        if (!catalogItemId.HasValue)
        {
            return null;
        }

        if (catalogItemId.Value == Guid.Empty)
        {
            return null;
        }

        return await dbContext.MembershipCatalogItems.SingleOrDefaultAsync(
            candidate => candidate.Id == catalogItemId.Value,
            cancellationToken);
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
