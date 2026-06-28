using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientMembershipService(GymCrmDbContext dbContext) : IClientMembershipService
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
        if (!IsValidCommand(clientId, command.ChangedByUserId, command.PaymentAmount, command.PurchaseDate))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (command.MembershipType == MembershipType.SingleVisit &&
            command.ExpirationDate.HasValue &&
            command.ExpirationDate.Value < command.PurchaseDate)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.ClientMissing);
        }

        var now = DateTimeOffset.UtcNow;
        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
        var sale = CreateSale(
            clientId,
            command.MembershipType,
            command.PurchaseDate,
            command.PaymentAmount,
            command.ChangedByUserId,
            now);

        dbContext.ClientMembershipSales.Add(sale);

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                sale.Id,
                command.MembershipType,
                command.PurchaseDate,
                ResolvePurchaseExpirationDate(command.MembershipType, command.PurchaseDate, command.ExpirationDate),
                command.PaymentAmount,
                command.IsPaid,
                false,
                command.IsPaid ? command.ChangedByUserId : null,
                command.IsPaid ? now : null,
                ClientMembershipChangeReason.NewPurchase,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> RenewAsync(
        Guid clientId,
        RenewClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValidCommand(clientId, command.ChangedByUserId, command.PaymentAmount, command.RenewalDate))
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.InvalidRequest);
        }

        if (command.ExpirationDate.HasValue &&
            command.ExpirationDate.Value < command.RenewalDate)
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

        var now = DateTimeOffset.UtcNow;
        var sale = CreateSale(
            clientId,
            currentMembership.MembershipType,
            command.RenewalDate,
            command.PaymentAmount,
            command.ChangedByUserId,
            now);

        dbContext.ClientMembershipSales.Add(sale);

        var expirationDate = await ResolveRenewalExpirationDateAsync(
            clientId,
            currentMembership,
            command.RenewalDate,
            command.ExpirationDate,
            cancellationToken);

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                sale.Id,
                currentMembership.MembershipType,
                command.RenewalDate,
                expirationDate,
                command.PaymentAmount,
                command.IsPaid,
                false,
                command.IsPaid ? command.ChangedByUserId : null,
                command.IsPaid ? now : null,
                ClientMembershipChangeReason.Renewal,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        return ClientMembershipMutationResult.Success(
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
    }

    public async Task<ClientMembershipMutationResult> CorrectAsync(
        Guid clientId,
        CorrectClientMembershipCommand command,
        CancellationToken cancellationToken)
    {
        if (!IsValidCommand(clientId, command.ChangedByUserId, command.PaymentAmount, command.PurchaseDate))
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
        var refundedAmount = nonCanceledRefunds.Sum(refund => refund.Amount);
        if (command.PaymentAmount < refundedAmount)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CorrectedGrossAmountBelowRefunds);
        }

        var earliestRefundDate = nonCanceledRefunds
            .Select(refund => (DateOnly?)refund.RefundDate)
            .OrderBy(refundDate => refundDate)
            .FirstOrDefault();
        if (earliestRefundDate.HasValue && command.PurchaseDate > earliestRefundDate.Value)
        {
            return ClientMembershipMutationResult.Failure(ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund);
        }

        var now = DateTimeOffset.UtcNow;
        ClientMembershipSaleAuditResult? saleAudit = null;
        if (currentSale.MembershipType != command.MembershipType ||
            currentSale.PurchaseDate != command.PurchaseDate ||
            currentSale.GrossAmount != command.PaymentAmount)
        {
            var oldSale = MapSaleSnapshot(currentSale);

            currentSale.MembershipType = command.MembershipType;
            currentSale.PurchaseDate = command.PurchaseDate;
            currentSale.GrossAmount = command.PaymentAmount;

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

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.SaleId,
                command.MembershipType,
                command.PurchaseDate,
                ResolveCorrectionExpirationDate(command.MembershipType, command.PurchaseDate, command.ExpirationDate),
                command.PaymentAmount,
                command.IsPaid,
                false,
                paidByUserId,
                paidAt,
                ClientMembershipChangeReason.Correction,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

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

        var now = DateTimeOffset.UtcNow;
        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.SaleId,
                currentMembership.MembershipType,
                currentMembership.PurchaseDate,
                currentMembership.ExpirationDate,
                currentMembership.PaymentAmount,
                true,
                currentMembership.SingleVisitUsed,
                command.ChangedByUserId,
                now,
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

        var professionalStatus = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Id == clientId)
            .Select(client => new { client.IsProfessional })
            .SingleOrDefaultAsync(cancellationToken);
        if (professionalStatus is null)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.ClientMissing);
        }

        if (professionalStatus.IsProfessional)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.ClientIsProfessional);
        }

        var currentMembership = await LoadCurrentMembershipAsync(clientId, cancellationToken);
        if (currentMembership is null)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.CurrentMembershipMissing);
        }

        if (currentMembership.MembershipType != MembershipType.SingleVisit)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.MembershipNotSingleVisit);
        }

        if (currentMembership.SingleVisitUsed)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.SingleVisitAlreadyUsed);
        }

        if (currentMembership.PurchaseDate > command.TrainingDate)
        {
            return SingleVisitWriteOffResult.Skip(SingleVisitWriteOffStatus.MembershipPurchasedAfterTrainingDate);
        }

        var previousMembership = MapMembershipSnapshot(currentMembership);
        var now = DateTimeOffset.UtcNow;

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
                currentMembership.SaleId,
                currentMembership.MembershipType,
                currentMembership.PurchaseDate,
                currentMembership.ExpirationDate,
                currentMembership.PaymentAmount,
                currentMembership.IsPaid,
                true,
                currentMembership.PaidByUserId,
                currentMembership.PaidAt,
                ClientMembershipChangeReason.SingleVisitWriteOff,
                command.ChangedByUserId,
                now),
            now,
            cancellationToken);

        var currentMembershipSnapshot = (await LoadDetailsRequiredAsync(clientId, cancellationToken)).CurrentMembership
            ?? throw new InvalidOperationException($"Current membership for client '{clientId}' was not found after single-visit write-off.");

        return SingleVisitWriteOffResult.Success(previousMembership, currentMembershipSnapshot);
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
            command.Amount <= 0 ||
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
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
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
        return await dbContext.ClientMemberships
            .AsNoTracking()
            .Include(membership => membership.Sale)
                .ThenInclude(sale => sale.Refunds)
            .Where(membership => membership.ClientId == clientId)
            .OrderByDescending(membership => membership.ValidFrom)
            .ThenByDescending(membership => membership.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    private async Task<ClientMembership?> LoadCurrentMembershipAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ClientMemberships
            .Include(membership => membership.Sale)
            .SingleOrDefaultAsync(
                membership => membership.ClientId == clientId && membership.ValidTo == null,
                cancellationToken);
    }

    private async Task ReplaceCurrentMembershipAsync(
        ClientMembership? currentMembership,
        ClientMembership nextMembership,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (currentMembership is not null)
        {
            currentMembership.ValidTo = now;
        }

        dbContext.ClientMemberships.Add(nextMembership);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static ClientMembership CreateMembership(
        Guid clientId,
        Guid saleId,
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? expirationDate,
        decimal paymentAmount,
        bool isPaid,
        bool singleVisitUsed,
        Guid? paidByUserId,
        DateTimeOffset? paidAt,
        ClientMembershipChangeReason changeReason,
        Guid changedByUserId,
        DateTimeOffset now)
    {
        return new ClientMembership
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            SaleId = saleId,
            MembershipType = membershipType,
            PurchaseDate = purchaseDate,
            ExpirationDate = expirationDate,
            PaymentAmount = paymentAmount,
            IsPaid = isPaid,
            SingleVisitUsed = singleVisitUsed,
            PaidByUserId = paidByUserId,
            PaidAt = paidAt,
            ChangeReason = changeReason,
            ChangedByUserId = changedByUserId,
            ValidFrom = now,
            CreatedAt = now
        };
    }

    private static ClientMembershipSale CreateSale(
        Guid clientId,
        MembershipType membershipType,
        DateOnly purchaseDate,
        decimal grossAmount,
        Guid createdByUserId,
        DateTimeOffset now)
    {
        return new ClientMembershipSale
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            MembershipType = membershipType,
            PurchaseDate = purchaseDate,
            GrossAmount = grossAmount,
            CreatedByUserId = createdByUserId,
            CreatedAt = now
        };
    }

    private static DateOnly? ResolvePurchaseExpirationDate(
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? requestedExpirationDate)
    {
        return membershipType switch
        {
            MembershipType.SingleVisit => requestedExpirationDate,
            MembershipType.Monthly or MembershipType.Yearly =>
                ClientMembershipSemantics.CalculateDefaultExpirationDate(membershipType, purchaseDate),
            _ => requestedExpirationDate
        };
    }

    private static DateOnly? ResolveCorrectionExpirationDate(
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? requestedExpirationDate)
    {
        return membershipType switch
        {
            MembershipType.SingleVisit => requestedExpirationDate,
            MembershipType.Monthly or MembershipType.Yearly =>
                requestedExpirationDate ?? ClientMembershipSemantics.CalculateDefaultExpirationDate(membershipType, purchaseDate),
            _ => requestedExpirationDate
        };
    }

    private async Task<DateOnly?> ResolveRenewalExpirationDateAsync(
        Guid clientId,
        ClientMembership currentMembership,
        DateOnly renewalDate,
        DateOnly? requestedExpirationDate,
        CancellationToken cancellationToken)
    {
        if (currentMembership.MembershipType == MembershipType.SingleVisit)
        {
            return requestedExpirationDate;
        }

        var calculationBaseDate = await ResolveRenewalBaseDateAsync(
            clientId,
            currentMembership,
            renewalDate,
            cancellationToken);

        var shouldExtendCurrentExpiration =
            currentMembership.ExpirationDate.HasValue &&
            calculationBaseDate == currentMembership.ExpirationDate.Value;

        if (shouldExtendCurrentExpiration)
        {
            return ClientMembershipSemantics.ExtendExpirationDate(
                currentMembership.MembershipType,
                calculationBaseDate);
        }

        return currentMembership.MembershipType switch
        {
            MembershipType.Monthly or MembershipType.Yearly =>
                ClientMembershipSemantics.CalculateDefaultExpirationDate(currentMembership.MembershipType, calculationBaseDate),
            _ => requestedExpirationDate
        };
    }

    private async Task<DateOnly> ResolveRenewalBaseDateAsync(
        Guid clientId,
        ClientMembership currentMembership,
        DateOnly renewalDate,
        CancellationToken cancellationToken)
    {
        var currentExpirationDate = currentMembership.ExpirationDate;
        if (!currentExpirationDate.HasValue)
        {
            return renewalDate;
        }

        if (renewalDate < currentExpirationDate.Value.AddMonths(1))
        {
            return currentExpirationDate.Value;
        }

        var hasAttendanceSinceExpiration = await dbContext.Attendance
            .AsNoTracking()
            .AnyAsync(
                attendance =>
                    attendance.ClientId == clientId &&
                    attendance.IsPresent &&
                    attendance.TrainingDate > currentExpirationDate.Value &&
                    attendance.TrainingDate <= renewalDate,
                cancellationToken);

        return hasAttendanceSinceExpiration
            ? currentExpirationDate.Value
            : renewalDate;
    }

    private static ClientMembershipDetailsResult CreateDetails(
        Guid clientId,
        IReadOnlyList<ClientMembership> memberships)
    {
        var history = memberships
            .Select(membership => new ClientMembershipSnapshotResult(
                membership.Id,
                membership.MembershipType,
                membership.PurchaseDate,
                membership.ExpirationDate,
                membership.PaymentAmount,
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
            membership.MembershipType,
            membership.PurchaseDate,
            membership.ExpirationDate,
            membership.PaymentAmount,
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
            CreateFinancialSummary(membership.Sale),
            MapRefunds(membership.Sale));
    }

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
            sale.MembershipType,
            sale.PurchaseDate,
            sale.GrossAmount,
            sale.CreatedByUserId,
            sale.CreatedAt);
    }

    private static bool IsValidCommand(
        Guid clientId,
        Guid changedByUserId,
        decimal paymentAmount,
        DateOnly date)
    {
        return clientId != Guid.Empty &&
            changedByUserId != Guid.Empty &&
            paymentAmount >= 0 &&
            date != default;
    }
}
