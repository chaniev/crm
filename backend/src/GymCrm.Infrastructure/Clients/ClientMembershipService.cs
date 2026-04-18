using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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

        await ReplaceCurrentMembershipAsync(
            currentMembership,
            CreateMembership(
                clientId,
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

        var now = DateTimeOffset.UtcNow;
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
            await LoadDetailsRequiredAsync(clientId, cancellationToken));
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

    private async Task<ClientMembershipDetailsResult> LoadDetailsRequiredAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await GetAsync(clientId, cancellationToken)
            ?? throw new InvalidOperationException($"Client membership details for '{clientId}' were not found.");
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

    private static DateOnly? ResolvePurchaseExpirationDate(
        MembershipType membershipType,
        DateOnly purchaseDate,
        DateOnly? requestedExpirationDate)
    {
        return membershipType switch
        {
            MembershipType.SingleVisit => requestedExpirationDate,
            MembershipType.Monthly => purchaseDate.AddMonths(1),
            MembershipType.Yearly => purchaseDate.AddYears(1),
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
            MembershipType.Monthly => requestedExpirationDate ?? purchaseDate.AddMonths(1),
            MembershipType.Yearly => requestedExpirationDate ?? purchaseDate.AddYears(1),
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

        return currentMembership.MembershipType switch
        {
            MembershipType.Monthly => calculationBaseDate.AddMonths(1),
            MembershipType.Yearly => calculationBaseDate.AddYears(1),
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
                membership.CreatedAt))
            .ToArray();

        return new ClientMembershipDetailsResult(
            clientId,
            history.FirstOrDefault(membership => membership.ValidTo is null),
            history);
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
