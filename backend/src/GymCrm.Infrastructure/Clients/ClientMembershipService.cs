using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipService(GymCrmDbContext dbContext, TimeProvider timeProvider) : IClientMembershipService
{
    public async Task<ClientMembershipDetailsResult?> GetAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var memberships = await LoadMembershipsAsync(clientId, cancellationToken);
        if (memberships.Count == 0)
        {
            var clientExists = await dbContext.Clients
                .AsNoTracking()
                .AnyAsync(client => client.Id == clientId, cancellationToken);

            return clientExists
                ? new ClientMembershipDetailsResult(clientId, null, [])
                : null;
        }

        return CreateDetails(clientId, memberships);
    }

    public async Task<ClientMembershipMutationResult> PurchaseAsync(
        Guid clientId,
        CreateClientMembershipPurchaseCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValidSaleCommand(clientId, command.ChangedByUserId, command.IsPaid, command.PaymentDate))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);

        var client = await dbContext.Clients.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == clientId, cancellationToken);
        if (client is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var today = GetToday();
        MembershipCatalogItem? item = null;
        if (command.MembershipCatalogItemId.HasValue)
        {
            if (command.MembershipCatalogItemId == Guid.Empty)
                return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CatalogItemMissing);
            item = await dbContext.MembershipCatalogItems.SingleOrDefaultAsync(
                candidate => candidate.Id == command.MembershipCatalogItemId.Value,
                cancellationToken);
            var itemError = ValidateCatalogItem(item, client.BranchId, today);
            if (itemError != ClientMembershipMutationError.None)
                return ClientMembershipMutationResult.Failure(itemError);
        }

        var pricing = ClientMembershipSalePricingPolicy.Resolve(item, command.ManualSaleAmount);
        if (!pricing.Succeeded)
            return ClientMembershipMutationResult.Failure(MapPricingError(pricing.Error));
        var resolution = pricing.Resolution!;
        if (resolution.BehaviorKind == MembershipBehaviorKind.Professional &&
            !await ActorHasRoleAsync(command.ChangedByUserId, UserRole.HeadCoach, cancellationToken))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ProfessionalPermissionDenied);
        if (!ValidateValidity(resolution.BehaviorKind, command.ValidFrom, command.ValidTo, command.ProfessionalComment))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipValidityInvalid);
        if (await HasActiveMembershipAsync(clientId, today, cancellationToken))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ActiveMembershipExists);

        await using var transaction = await BeginTransactionIfSupportedAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();
        var sale = CreateSale(clientId, item, resolution, today, command.ChangedByUserId, now);
        dbContext.ClientMembershipSales.Add(sale);
        dbContext.ClientMemberships.Add(CreateMembership(clientId, sale, command.ValidFrom, command.ValidTo,
            command.IsPaid, command.PaymentDate, false, command.ProfessionalComment, ClientMembershipChangeReason.NewPurchase,
            command.ChangedByUserId, now));
        await dbContext.SaveChangesAsync(cancellationToken);
        await CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipCommentMutationResult> UpdateCommentAsync(
        Guid clientId, Guid saleId, UpdateClientMembershipCommentCommand command, CancellationToken cancellationToken)
    {
        var sale = await dbContext.ClientMembershipSales
            .SingleOrDefaultAsync(candidate => candidate.Id == saleId && candidate.ClientId == clientId, cancellationToken);
        if (sale is null) return ClientMembershipCommentMutationResult.Missing();

        var transition = ClientMembershipCommentPolicy.Apply(sale, command.Comment, command.ChangedByUserId, timeProvider.GetUtcNow());
        if (transition is not null) await dbContext.SaveChangesAsync(cancellationToken);
        return ClientMembershipCommentMutationResult.Success(transition, await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValidSaleCommand(clientId, command.ChangedByUserId, command.IsPaid, command.PaymentDate))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var today = GetToday();
        var currentMembership = await LoadLatestMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CurrentMembershipMissing);
        }

        if (currentMembership.BehaviorKind is MembershipBehaviorKind.SingleVisit || currentMembership.IndividualValidTo is null)
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.RenewalNotAllowed);

        var clientBranchId = await dbContext.Clients.Where(client => client.Id == clientId).Select(client => client.BranchId).SingleAsync(cancellationToken);
        MembershipCatalogItem? item = null;
        if (command.MembershipCatalogItemId.HasValue)
        {
            if (command.MembershipCatalogItemId == Guid.Empty)
                return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CatalogItemMissing);
            item = await dbContext.MembershipCatalogItems.SingleOrDefaultAsync(
                candidate => candidate.Id == command.MembershipCatalogItemId.Value,
                cancellationToken);
            var itemError = ValidateCatalogItem(item, clientBranchId, today);
            if (itemError != ClientMembershipMutationError.None)
                return ClientMembershipMutationResult.Failure(itemError);
        }

        var pricing = ClientMembershipSalePricingPolicy.Resolve(item, command.ManualSaleAmount);
        if (!pricing.Succeeded)
            return ClientMembershipMutationResult.Failure(MapPricingError(pricing.Error));
        var resolution = pricing.Resolution!;
        if (resolution.BehaviorKind != currentMembership.BehaviorKind)
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.MembershipValidityInvalid);
        if (resolution.BehaviorKind == MembershipBehaviorKind.Professional &&
            !await ActorHasRoleAsync(command.ChangedByUserId, UserRole.HeadCoach, cancellationToken))
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ProfessionalPermissionDenied);

        var lastEnd = await dbContext.ClientMemberships.Where(membership => membership.ClientId == clientId && membership.IndividualValidTo != null)
            .MaxAsync(membership => membership.IndividualValidTo, cancellationToken);
        if (lastEnd is null) return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.RenewalNotAllowed);
        var validFrom = lastEnd.Value.AddDays(1);
        var duration = currentMembership.IndividualValidTo.Value.DayNumber - currentMembership.IndividualValidFrom!.Value.DayNumber;
        var validTo = validFrom.AddDays(duration);
        var now = timeProvider.GetUtcNow();
        var sale = CreateSale(clientId, item, resolution, today, command.ChangedByUserId, now);
        dbContext.ClientMembershipSales.Add(sale);
        dbContext.ClientMemberships.Add(CreateMembership(clientId, sale, validFrom, validTo, command.IsPaid,
            command.PaymentDate, false, command.ProfessionalComment, ClientMembershipChangeReason.Renewal, command.ChangedByUserId, now));
        await dbContext.SaveChangesAsync(cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty || command.ChangedByUserId == Guid.Empty || command.PurchaseDate == default)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (command.ExpirationDate.HasValue &&
            command.ExpirationDate.Value < command.PurchaseDate)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CurrentMembershipMissing);
        }

        var currentSale = currentMembership.Sale;
        var nonCanceledRefunds = await dbContext.ClientMembershipRefunds
            .Where(refund => refund.SaleId == currentSale.Id && refund.CanceledAt == null)
            .ToArrayAsync(cancellationToken);
        var earliestRefundDate = nonCanceledRefunds
            .Select(refund => (DateOnly?)refund.RefundDate)
            .OrderBy(refundDate => refundDate)
            .FirstOrDefault();
        if (earliestRefundDate.HasValue && command.PurchaseDate > earliestRefundDate.Value)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund);
        }

        var now = timeProvider.GetUtcNow();
        ClientMembershipSaleAuditResult? saleAudit = null;
        if (currentSale.PurchaseDate != command.PurchaseDate)
        {
            var oldSale = MapSaleSnapshot(currentSale);

            currentSale.PurchaseDate = command.PurchaseDate;

            saleAudit = new ClientMembershipSaleAuditResult(oldSale, MapSaleSnapshot(currentSale));
        }

        Guid? paidByUserId = command.IsPaid
            ? currentMembership.IsPaid
                ? currentMembership.PaidByUserId ?? command.ChangedByUserId
                : command.ChangedByUserId
            : null;
        DateTimeOffset? paidAt = command.IsPaid
            ? currentMembership.IsPaid
                ? currentMembership.PaidAt ?? now
                : now
            : null;

        await ReplaceCurrentMembershipAsync(currentMembership,
            CreateMembership(clientId, currentSale,
                currentMembership.BehaviorKind == MembershipBehaviorKind.SingleVisit ? null : command.PurchaseDate,
                currentMembership.BehaviorKind == MembershipBehaviorKind.SingleVisit ? null : command.ExpirationDate,
                command.IsPaid, command.IsPaid ? command.PurchaseDate : null, false, currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.Correction, command.ChangedByUserId, now), now, cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken),
            saleAudit);
    }

    public async Task<ClientMembershipMutationResult> MarkPaymentAsync(
        Guid clientId,
        MarkClientMembershipPaymentCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty || command.ChangedByUserId == Guid.Empty)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CurrentMembershipMissing);
        }

        if (currentMembership.IsPaid)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CurrentMembershipAlreadyPaid);
        }

        var now = timeProvider.GetUtcNow();
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                true,
                GetToday(),
                currentMembership.SingleVisitUsed,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.PaymentUpdate,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

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

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.ClientMissing);
        }

        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
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

        var previousMembership = MapMembershipSnapshot(currentMembership);
        var now = timeProvider.GetUtcNow();

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                currentMembership.IsPaid,
                currentMembership.IsPaid ? DateOnly.FromDateTime(currentMembership.PaidAt!.Value.UtcDateTime) : null,
                true,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitWriteOff,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        var currentMembershipSnapshot = (await LoadDetailsRequiredAsync(clientId, cancellationToken)).CurrentMembership
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

        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null ||
            currentMembership.Id != command.ExpectedWriteOffMembershipId ||
            currentMembership.SaleId != command.ExpectedSaleId ||
            currentMembership.BehaviorKind != MembershipBehaviorKind.SingleVisit ||
            !currentMembership.SingleVisitUsed ||
            currentMembership.ChangeReason != ClientMembershipChangeReason.SingleVisitWriteOff)
        {
            return SingleVisitRestoreResult.Failure(SingleVisitRestoreStatus.Conflict);
        }

        var previousMembership = MapMembershipSnapshot(currentMembership);
        var now = timeProvider.GetUtcNow();
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.Sale,
                currentMembership.IndividualValidFrom,
                currentMembership.IndividualValidTo,
                currentMembership.IsPaid,
                currentMembership.IsPaid ? DateOnly.FromDateTime(currentMembership.PaidAt!.Value.UtcDateTime) : null,
                false,
                currentMembership.ProfessionalComment,
                ClientMembershipChangeReason.SingleVisitRestore,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        var restoredMembership = (await LoadDetailsRequiredAsync(clientId, cancellationToken)).CurrentMembership
            ?? throw new InvalidOperationException($"Current membership for client '{clientId}' was not found after single-visit restore.");

        return SingleVisitRestoreResult.Success(previousMembership, restoredMembership);
    }

    public async Task<ClientMembershipRefundMutationResult> RegisterRefundAsync(
        Guid clientId,
        RegisterClientMembershipRefundCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.SaleId == Guid.Empty ||
            command.RefundDate == default ||
            !RubMoneyPolicy.IsWholeAmount(command.Amount, allowZero: false) ||
            command.Comment?.Length > ClientMembershipRefund.CommentMaxLength)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.InvalidRequest);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.ClientMissing);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (command.RefundDate > today)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateInFuture);
        }

        await using var transaction = await BeginTransactionIfSupportedAsync(cancellationToken);
        var sale = await dbContext.ClientMembershipSales
            .Include(candidate => candidate.Refunds)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == command.SaleId && candidate.ClientId == clientId,
                cancellationToken);

        if (sale is null)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.SaleMissing);
        }

        if (command.RefundDate < sale.PurchaseDate)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateBeforePurchaseDate);
        }

        var saleCreatedDate = DateOnly.FromDateTime(sale.CreatedAt.UtcDateTime.Date);
        if (command.RefundDate < saleCreatedDate)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundDateBeforeSaleCreatedDate);
        }

        var refundedAmount = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .Sum(refund => refund.Amount);
        if (refundedAmount + command.Amount > sale.GrossAmount)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundAmountExceedsGrossAmount);
        }

        var now = DateTimeOffset.UtcNow;
        var refund = new ClientMembershipRefund
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            ClientId = clientId,
            Amount = command.Amount,
            RefundDate = command.RefundDate,
            Comment = string.IsNullOrWhiteSpace(command.Comment) ? null : command.Comment.Trim(),
            CreatedByUserId = command.ChangedByUserId,
            CreatedAt = now
        };

        dbContext.ClientMembershipRefunds.Add(refund);
        await dbContext.SaveChangesAsync(cancellationToken);
        await CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipRefundMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken),
            MapRefundSnapshot(refund));
    }

    public async Task<ClientMembershipRefundMutationResult> CancelRefundAsync(
        Guid clientId,
        CancelClientMembershipRefundCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.ChangedByUserId == Guid.Empty ||
            command.RefundId == Guid.Empty)
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.InvalidRequest);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.ClientMissing);
        }

        await using var transaction = await BeginTransactionIfSupportedAsync(cancellationToken);
        var refund = await dbContext.ClientMembershipRefunds
            .SingleOrDefaultAsync(
                candidate => candidate.Id == command.RefundId && candidate.ClientId == clientId,
                cancellationToken);

        if (refund is null)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundMissing);
        }

        if (refund.CanceledAt is not null)
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            return ClientMembershipRefundMutationResult.Failure(ClientMembershipRefundMutationError.RefundAlreadyCanceled);
        }

        var previousRefund = MapRefundSnapshot(refund);
        refund.CanceledAt = DateTimeOffset.UtcNow;
        refund.CanceledByUserId = command.ChangedByUserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await CommitIfPresentAsync(transaction, cancellationToken);

        return ClientMembershipRefundMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken),
            MapRefundSnapshot(refund),
            previousRefund);
    }

    private async Task<ClientMembershipDetailsResult> LoadDetailsRequiredAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await GetAsync(clientId, cancellationToken)
            ?? throw new InvalidOperationException($"Client membership details for '{clientId}' were not found.");
    }

    private async Task<IDbContextTransaction?> BeginTransactionIfSupportedAsync(CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory" ||
               dbContext.Database.CurrentTransaction is not null
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    private static async Task CommitIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private static async Task RollbackIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }

    private async Task<bool> ClientExistsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .AnyAsync(client => client.Id == clientId, cancellationToken);
    }

    private async Task<List<ClientMembership>> LoadMembershipsAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        var memberships = await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.Refunds)
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.CommentChangedByUser)
            .Where(membership => membership.ClientId == clientId)
            .ToListAsync(cancellationToken);

        return memberships
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ToList();
    }

    private async Task<ClientMembership?> LoadCurrentMembershipAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ClientMemberships
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.MembershipCatalogItem)
            .Where(membership => membership.ClientId == clientId && membership.ValidTo == null)
            .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.IndividualValidFrom ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<ClientMembership?> LoadLatestMembershipAsync(Guid clientId, CancellationToken cancellationToken) =>
        await dbContext.ClientMemberships.Include(membership => membership.Sale)
            .OrderByDescending(membership => membership.IndividualValidTo ?? DateOnly.MaxValue)
            .ThenByDescending(membership => membership.CreatedAt)
            .FirstOrDefaultAsync(membership => membership.ClientId == clientId, cancellationToken);

    private async Task<bool> HasActiveMembershipAsync(Guid clientId, DateOnly today, CancellationToken cancellationToken) =>
        await dbContext.ClientMemberships.AnyAsync(membership => membership.ClientId == clientId &&
            (membership.BehaviorKind == MembershipBehaviorKind.SingleVisit
                ? !membership.SingleVisitUsed && membership.ValidTo == null
                : membership.IndividualValidFrom <= today && (membership.IndividualValidTo == null || membership.IndividualValidTo >= today)), cancellationToken);

    private DateOnly GetToday() => DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime);

    private static bool IsValidSaleCommand(Guid clientId, Guid actorId, bool isPaid, DateOnly? paymentDate) =>
        clientId != Guid.Empty && actorId != Guid.Empty &&
        (isPaid ? paymentDate.HasValue : !paymentDate.HasValue);

    private async Task<bool> ActorHasRoleAsync(Guid actorId, UserRole role, CancellationToken cancellationToken) =>
        await dbContext.Users.AnyAsync(user => user.Id == actorId && user.Role == role, cancellationToken);

    private static ClientMembershipMutationError MapPricingError(ClientMembershipSalePricingError error) => error switch
    {
        ClientMembershipSalePricingError.MissingCatalogAndAmount => ClientMembershipMutationError.PricingSelectionMissing,
        ClientMembershipSalePricingError.InvalidManualAmount => ClientMembershipMutationError.ManualSaleAmountInvalid,
        ClientMembershipSalePricingError.ProfessionalOverrideNotAllowed => ClientMembershipMutationError.ProfessionalOverrideNotAllowed,
        ClientMembershipSalePricingError.InvalidCatalogPrice => ClientMembershipMutationError.InvalidRequest,
        _ => ClientMembershipMutationError.InvalidRequest
    };

    private static ClientMembershipMutationError ValidateCatalogItem(MembershipCatalogItem? item, Guid branchId, DateOnly today)
    {
        if (item is null) return ClientMembershipMutationError.CatalogItemMissing;
        if (item.BranchId.HasValue && item.BranchId != branchId) return ClientMembershipMutationError.CatalogItemBranchMismatch;
        return item.IsAvailableOn(today) ? ClientMembershipMutationError.None : ClientMembershipMutationError.CatalogItemUnavailable;
    }

    private static bool ValidateValidity(MembershipBehaviorKind kind, DateOnly? validFrom, DateOnly? validTo, string? comment) =>
        kind switch
        {
            MembershipBehaviorKind.SingleVisit => validFrom is null && validTo is null && string.IsNullOrWhiteSpace(comment),
            MembershipBehaviorKind.Term => validFrom.HasValue && validTo >= validFrom && string.IsNullOrWhiteSpace(comment),
            MembershipBehaviorKind.Professional => validFrom.HasValue && (validTo is null || validTo >= validFrom) && !string.IsNullOrWhiteSpace(comment),
            _ => false
        };

    private static ClientMembership CreateMembership(Guid clientId, ClientMembershipSale sale,
        DateOnly? validFrom, DateOnly? validTo, bool isPaid, DateOnly? paymentDate,
        bool singleVisitUsed, string? professionalComment, ClientMembershipChangeReason reason, Guid actorId, DateTimeOffset now)
    {
        return new ClientMembership
        {
            Id = Guid.NewGuid(), ClientId = clientId, SaleId = sale.Id,
            BehaviorKind = sale.BehaviorKind, IndividualValidFrom = validFrom, IndividualValidTo = validTo,
            ProfessionalComment = string.IsNullOrWhiteSpace(professionalComment) ? null : professionalComment.Trim(),
            IsPaid = isPaid, SingleVisitUsed = singleVisitUsed,
            PaidByUserId = isPaid ? actorId : null,
            PaidAt = isPaid && paymentDate.HasValue ? new DateTimeOffset(paymentDate.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) : null,
            ChangeReason = reason, ChangedByUserId = actorId, ValidFrom = now, CreatedAt = now
        };
    }

    private static ClientMembershipSale CreateSale(
        Guid clientId,
        MembershipCatalogItem? item,
        ClientMembershipSalePricingResolution pricing,
        DateOnly purchaseDate,
        Guid actorId,
        DateTimeOffset now)
    {
        return new ClientMembershipSale
        {
            Id = Guid.NewGuid(), ClientId = clientId, MembershipCatalogItemId = pricing.MembershipCatalogItemId,
            MembershipCatalogItem = item, BehaviorKind = pricing.BehaviorKind, PricingMode = pricing.PricingMode,
            PurchaseDate = purchaseDate, GrossAmount = pricing.GrossAmount,
            CreatedByUserId = actorId, CreatedAt = now
        };
    }

    private async Task ReplaceCurrentMembershipAsync(
        ClientMembership? currentMembership,
        ClientMembership nextMembership,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginTransactionIfSupportedAsync(cancellationToken);

        try
        {
            if (currentMembership is not null)
            {
                currentMembership.ValidTo = now;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            dbContext.ClientMemberships.Add(nextMembership);
            await dbContext.SaveChangesAsync(cancellationToken);
            await CommitIfPresentAsync(transaction, cancellationToken);
        }
        catch
        {
            await RollbackIfPresentAsync(transaction, cancellationToken);
            throw;
        }
    }

    private static ClientMembershipDetailsResult CreateDetails(
        Guid clientId,
        IReadOnlyList<ClientMembership> memberships)
    {
        var history = memberships
            .Select(membership => new ClientMembershipSnapshotResult(
                membership.Id,
                membership.Sale.MembershipCatalogItemId,
                ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
                membership.BehaviorKind,
                membership.Sale.PricingMode,
                membership.Sale.GrossAmount,
                ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
                membership.Sale.PurchaseDate,
                membership.IndividualValidTo,
                membership.IndividualValidFrom,
                membership.IndividualValidTo,
                membership.ProfessionalComment,
                membership.IsPaid,
                membership.SingleVisitUsed,
                membership.PaidByUserId,
                membership.PaidAt,
                membership.ValidFrom,
                membership.ValidTo,
                membership.ChangeReason,
                membership.ChangedByUserId,
                membership.CreatedAt,
                membership.SaleId,
                membership.Sale.Comment,
                ResolveCommentAuthorName(membership.Sale),
                ResolveCommentChangedAt(membership.Sale),
                CreateFinancialSummary(membership.Sale),
                MapRefunds(membership.Sale)))
            .ToArray();

        return new ClientMembershipDetailsResult(
            clientId,
            history.FirstOrDefault(membership => membership.ValidTo is null),
            history);
    }

    private static ClientMembershipSnapshotResult MapMembershipSnapshot(ClientMembership membership)
    {
        return new ClientMembershipSnapshotResult(
            membership.Id,
            membership.Sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(membership.Sale),
            membership.BehaviorKind,
            membership.Sale.PricingMode,
            membership.Sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(membership.Sale),
            membership.Sale.PurchaseDate,
            membership.IndividualValidTo,
            membership.IndividualValidFrom,
            membership.IndividualValidTo,
            membership.ProfessionalComment,
            membership.IsPaid,
            membership.SingleVisitUsed,
            membership.PaidByUserId,
            membership.PaidAt,
            membership.ValidFrom,
            membership.ValidTo,
            membership.ChangeReason,
            membership.ChangedByUserId,
            membership.CreatedAt,
            membership.SaleId,
            membership.Sale.Comment,
            ResolveCommentAuthorName(membership.Sale),
            ResolveCommentChangedAt(membership.Sale),
            CreateFinancialSummary(membership.Sale),
            MapRefunds(membership.Sale));
    }

    private static string? ResolveCommentAuthorName(ClientMembershipSale sale) =>
        sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null
            ? sale.CommentChangedByUser.FullName : null;

    private static DateTimeOffset? ResolveCommentChangedAt(ClientMembershipSale sale) =>
        sale.CommentChangedByUserId.HasValue && sale.CommentChangedAt.HasValue && sale.CommentChangedByUser is not null
            ? sale.CommentChangedAt : null;

    private static ClientMembershipFinancialSummaryResult CreateFinancialSummary(ClientMembershipSale sale)
    {
        var nonCanceledRefunds = sale.Refunds
            .Where(refund => refund.CanceledAt is null)
            .ToArray();
        var refundedAmount = nonCanceledRefunds.Sum(refund => refund.Amount);
        var refundStatus = refundedAmount <= 0
            ? ClientMembershipRefundStatus.None
            : refundedAmount >= sale.GrossAmount
                ? ClientMembershipRefundStatus.Full
                : ClientMembershipRefundStatus.Partial;

        return new ClientMembershipFinancialSummaryResult(
            sale.GrossAmount,
            refundedAmount,
            sale.GrossAmount - refundedAmount,
            refundStatus,
            nonCanceledRefunds
                .Select(refund => (DateOnly?)refund.RefundDate)
                .OrderByDescending(refundDate => refundDate)
                .FirstOrDefault());
    }

    private static IReadOnlyList<ClientMembershipRefundSnapshotResult> MapRefunds(ClientMembershipSale sale)
    {
        return sale.Refunds
            .OrderByDescending(refund => refund.RefundDate)
            .ThenByDescending(refund => refund.CreatedAt)
            .ThenByDescending(refund => refund.Id)
            .Select(MapRefundSnapshot)
            .ToArray();
    }

    private static ClientMembershipRefundSnapshotResult MapRefundSnapshot(ClientMembershipRefund refund)
    {
        return new ClientMembershipRefundSnapshotResult(
            refund.Id,
            refund.SaleId,
            refund.ClientId,
            refund.Amount,
            refund.RefundDate,
            refund.Comment,
            refund.CreatedByUserId,
            refund.CreatedAt,
            refund.CanceledAt,
            refund.CanceledByUserId);
    }

    private static ClientMembershipSaleSnapshotResult MapSaleSnapshot(ClientMembershipSale sale)
    {
        return new ClientMembershipSaleSnapshotResult(
            sale.Id,
            sale.ClientId,
            sale.MembershipCatalogItemId,
            ClientMembershipSaleDisplay.GetMembershipName(sale),
            sale.BehaviorKind,
            sale.PricingMode,
            sale.PurchaseDate,
            sale.GrossAmount,
            ClientMembershipSaleDisplay.GetCatalogPrice(sale),
            sale.CreatedByUserId,
            sale.CreatedAt);
    }

    private static bool IsValidCommand(
        Guid clientId,
        Guid changedByUserId,
        decimal amount,
        DateOnly date)
    {
        return clientId != Guid.Empty &&
            changedByUserId != Guid.Empty &&
            amount >= 0 &&
            date != default;
    }
}
