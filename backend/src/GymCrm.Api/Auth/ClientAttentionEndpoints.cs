using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace GymCrm.Api.Auth;

internal static class ClientAttentionEndpoints
{
    private const string MissedTraining = "missedTraining";
    private const string ExpiredMembership = "expiredMembership";
    private const string ExpiringMembership = "expiringMembership";
    private const string ContactedAction = "ClientMissedTrainingContacted";

    public static IEndpointRouteBuilder MapClientAttentionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/clients")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);

        group.MapGet("/attention", ListAttentionAsync);
        group.MapPost("/{clientId:guid}/attention/missed-training/contacted", MarkContactedAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAttentionAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        MissedTrainingStreakCalculator calculator,
        IBusinessDateProvider businessDateProvider,
        IOptions<ClientAttentionOptions> options,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var cards = await BuildCardsAsync(
            dbContext,
            calculator,
            options.Value.MembershipWindowDays,
            businessDateProvider.Today,
            currentUser,
            null,
            cancellationToken);
        return TypedResults.Ok(cards);
    }

    private static async Task<IResult> MarkContactedAsync(
        Guid clientId,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        MissedTrainingStreakCalculator calculator,
        IBusinessDateProvider businessDateProvider,
        IOptions<ClientAttentionOptions> options,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfFailure = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfFailure is not null)
        {
            return csrfFailure;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var clientExists = await ApplyScope(dbContext.Clients.AsNoTracking(), currentUser)
            .AnyAsync(client => client.Id == clientId, cancellationToken);
        if (!clientExists)
        {
            return TypedResults.NotFound();
        }

        var before = (await BuildCardsAsync(
                dbContext,
                calculator,
                options.Value.MembershipWindowDays,
                businessDateProvider.Today,
                currentUser,
                clientId,
                cancellationToken))
            .SingleOrDefault();
        var missedReason = before?.Reasons.FirstOrDefault(reason => reason.Type == MissedTraining);

        // An already handled sequence is a successful idempotent command. It must not create
        // another boundary or audit entry.
        if (missedReason is null)
        {
            return before is null ? TypedResults.NoContent() : TypedResults.Ok(before);
        }

        var lastAttendance = await dbContext.Attendance
            .Where(attendance => attendance.ClientId == clientId)
            .OrderByDescending(attendance => attendance.TrainingDate)
            .ThenByDescending(attendance => attendance.Group.TrainingStartTime)
            .ThenByDescending(attendance => attendance.Id)
            .Select(attendance => new
            {
                attendance.Id,
                attendance.TrainingDate,
                attendance.Group.TrainingStartTime
            })
            .FirstAsync(cancellationToken);

        // The integration-test host replaces PostgreSQL with EF's in-memory provider while
        // retaining relational services in the container, so IsRelational() alone is not a
        // reliable capability check here.
        var supportsTransactions = dbContext.Database.IsRelational()
            && dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory";
        await using var transaction = supportsTransactions
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;
        try
        {
            var acknowledgement = await dbContext.ClientMissedTrainingAcknowledgements
                .SingleOrDefaultAsync(candidate => candidate.ClientId == clientId, cancellationToken);
            if (acknowledgement is not null && acknowledgement.LastAttendanceId == lastAttendance.Id)
            {
                if (transaction is not null)
                {
                    await transaction.CommitAsync(cancellationToken);
                }

                var unchanged = (await BuildCardsAsync(
                        dbContext,
                        calculator,
                        options.Value.MembershipWindowDays,
                        businessDateProvider.Today,
                        currentUser,
                        clientId,
                        cancellationToken))
                    .SingleOrDefault();
                return unchanged is null ? TypedResults.NoContent() : TypedResults.Ok(unchanged);
            }

            if (acknowledgement is null)
            {
                acknowledgement = new ClientMissedTrainingAcknowledgement
                {
                    Id = Guid.NewGuid(),
                    ClientId = clientId
                };
                dbContext.ClientMissedTrainingAcknowledgements.Add(acknowledgement);
            }

            var acknowledgedAt = DateTimeOffset.UtcNow;
            acknowledgement.LastAttendanceId = lastAttendance.Id;
            acknowledgement.LastTrainingDate = lastAttendance.TrainingDate;
            acknowledgement.LastTrainingStartTime = lastAttendance.TrainingStartTime;
            acknowledgement.AcknowledgedAt = acknowledgedAt;
            acknowledgement.AcknowledgedByUserId = currentUser.Id;
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditLogService.WriteAsync(
                new AuditLogEntry(
                    currentUser.Id,
                    ContactedAction,
                    "ClientMissedTrainingAcknowledgement",
                    acknowledgement.Id.ToString(),
                    $"{currentUser.Login} отметил связь с клиентом {before!.FullName} после {missedReason.MissedCount} пропусков.",
                    null,
                    JsonSerializer.Serialize(new
                    {
                        acknowledgement.ClientId,
                        acknowledgement.LastAttendanceId,
                        acknowledgement.LastTrainingDate,
                        acknowledgement.LastTrainingStartTime,
                        acknowledgement.AcknowledgedAt
                    })),
                cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            dbContext.ChangeTracker.Clear();
            // A competing identical command won the unique ClientId boundary. Returning the
            // resulting representation preserves double-click idempotency.
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            dbContext.ChangeTracker.Clear();
        }

        var after = (await BuildCardsAsync(
                dbContext,
                calculator,
                options.Value.MembershipWindowDays,
                businessDateProvider.Today,
                currentUser,
                clientId,
                cancellationToken))
            .SingleOrDefault();
        return after is null ? TypedResults.NoContent() : TypedResults.Ok(after);
    }

    private static async Task<IReadOnlyList<ClientAttentionResponse>> BuildCardsAsync(
        GymCrmDbContext dbContext,
        MissedTrainingStreakCalculator calculator,
        int membershipWindowDays,
        DateOnly today,
        User currentUser,
        Guid? clientId,
        CancellationToken cancellationToken)
    {
        var clientsQuery = ApplyScope(
                dbContext.Clients.AsNoTracking().Where(client => client.Status == ClientStatus.Active),
                currentUser)
            .Where(client => !clientId.HasValue || client.Id == clientId.Value);

        var clients = await clientsQuery
            .Include(client => client.Memberships)
                .ThenInclude(membership => membership.Sale)
                    .ThenInclude(sale => sale.MembershipCatalogItem)
            .Include(client => client.AttendanceEntries)
                .ThenInclude(attendance => attendance.Group)
            .Include(client => client.MissedTrainingAcknowledgements)
            .Include(client => client.MessengerAccounts)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);

        var cards = new List<ClientAttentionResponse>();
        foreach (var client in clients)
        {
            var currentMembership = client.Memberships
                .Where(membership => membership.ValidTo is null)
                .OrderByDescending(membership => membership.ValidFrom)
                .ThenByDescending(membership => membership.CreatedAt)
                .ThenByDescending(membership => membership.Id)
                .FirstOrDefault();
            var hasProfessionalMembership = client.Memberships.Any(membership =>
                membership.ValidTo is null &&
                membership.BehaviorKind == MembershipBehaviorKind.Professional &&
                membership.IndividualValidFrom.HasValue &&
                membership.IndividualValidFrom.Value <= today &&
                (!membership.IndividualValidTo.HasValue || membership.IndividualValidTo.Value >= today));

            var reasons = new List<ClientAttentionReasonResponse>();
            if (!hasProfessionalMembership && currentMembership is not null)
            {
                var expirationDate = currentMembership.IndividualValidTo;
                var days = expirationDate?.DayNumber - today.DayNumber;
                if (days is < 0)
                {
                    reasons.Add(new ClientAttentionReasonResponse(ExpiredMembership, null, expirationDate, days));
                }
                else if (days is not null && days <= membershipWindowDays)
                {
                    reasons.Add(new ClientAttentionReasonResponse(ExpiringMembership, null, expirationDate, days));
                }

            }

            var acknowledgement = client.MissedTrainingAcknowledgements.SingleOrDefault();
            var boundary = acknowledgement is null
                ? null
                : new MissedTrainingAcknowledgementBoundary(
                    acknowledgement.LastAttendanceId,
                    acknowledgement.LastTrainingDate,
                    acknowledgement.LastTrainingStartTime,
                    acknowledgement.AcknowledgedAt);
            var missedCount = calculator.Calculate(
                client.AttendanceEntries.Select(attendance => new MissedTrainingAttendanceEvent(
                    attendance.Id,
                    attendance.TrainingDate,
                    attendance.Group.TrainingStartTime,
                    attendance.IsPresent ? AttendanceState.Present : AttendanceState.Absent,
                    attendance.MarkedAt)),
                boundary);
            if (missedCount >= MissedTrainingStreakCalculator.AttentionThreshold)
            {
                reasons.Insert(0, new ClientAttentionReasonResponse(MissedTraining, missedCount));
            }

            if (reasons.Count == 0)
            {
                continue;
            }

            var telegramUsername = client.MessengerAccounts
                .Where(account =>
                    account.Platform == MessengerPlatform.Telegram &&
                    account.UnlinkedAt is null &&
                    !string.IsNullOrWhiteSpace(account.Username))
                .OrderByDescending(account => account.LinkedAt)
                .ThenBy(account => account.Id)
                .Select(account => account.Username!.Trim().TrimStart('@'))
                .FirstOrDefault(IsValidTelegramUsername);
            cards.Add(new ClientAttentionResponse(
                client.Id,
                BuildFullName(client),
                client.Phone,
                client.Notes,
                currentMembership is null
                    ? null
                    : new ClientAttentionMembershipResponse(
                        currentMembership.BehaviorKind.ToString(),
                        ClientMembershipSaleDisplay.GetMembershipName(currentMembership.Sale),
                        currentMembership.IndividualValidTo,
                        currentMembership.IndividualValidTo?.DayNumber - today.DayNumber),
                telegramUsername is null ? null : $"https://t.me/{telegramUsername}",
                reasons));
        }

        return cards
            .OrderByDescending(card => card.Reasons.Any(reason => reason.Type == MissedTraining))
            .ThenBy(card => card.Membership?.ExpirationDate ?? DateOnly.MaxValue)
            .ThenBy(card => card.FullName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(card => card.ClientId)
            .ToArray();
    }

    private static IQueryable<Client> ApplyScope(IQueryable<Client> query, User currentUser)
    {
        return currentUser.Role == UserRole.Administrator
            ? query.Where(client => currentUser.BranchId.HasValue && client.BranchId == currentUser.BranchId.Value)
            : query;
    }

    private static string BuildFullName(Client client) => string.Join(
        " ",
        new[] { client.LastName, client.FirstName, client.MiddleName }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

    private static bool IsValidTelegramUsername(string username) =>
        username.Length is >= 5 and <= 32 &&
        username.All(character => char.IsAsciiLetterOrDigit(character) || character == '_');
}
