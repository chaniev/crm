using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace GymCrm.Infrastructure.Clients;

internal static class ClientMutationPersistence
{
    internal const string MembershipIdempotencyPending = "Pending";
    internal const string MembershipIdempotencyCompleted = "Completed";
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    internal static async Task DeletePendingMembershipReservationAsync(Guid? recordId, IServiceScopeFactory serviceScopeFactory)
    {
        if (recordId is null) return;
        using var cleanupTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var cleanupScope = serviceScopeFactory.CreateAsyncScope();
        var dbContext = cleanupScope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        // A failed/uncertain commit can have persisted Completed. Never delete that record.
        if (dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
        {
            await dbContext.ClientMembershipIdempotencyRecords
                .Where(candidate => candidate.Id == recordId && candidate.Status == MembershipIdempotencyPending)
                .ExecuteDeleteAsync(cleanupTimeout.Token);
            return;
        }
        var record = await dbContext.ClientMembershipIdempotencyRecords.SingleOrDefaultAsync(
            candidate => candidate.Id == recordId && candidate.Status == MembershipIdempotencyPending,
            cleanupTimeout.Token);
        if (record is not null)
        {
            dbContext.ClientMembershipIdempotencyRecords.Remove(record);
            await dbContext.SaveChangesAsync(cleanupTimeout.Token);
        }
    }

    internal static async Task CommitMembershipActionTransactionAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    internal static async Task RollbackMembershipActionTransactionAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }

    internal static string ComputeMembershipIdempotencyPayloadHash(object payload)
    {
        var json = JsonSerializer.Serialize(payload, AuditSerializerOptions);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes);
    }

    internal static bool IsMembershipIdempotencyUniqueException(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException postgresException &&
               string.Equals(postgresException.SqlState, PostgresErrorCodes.UniqueViolation, StringComparison.Ordinal) &&
               string.Equals(
                   postgresException.ConstraintName,
                   GymCrmDbContext.ClientMembershipIdempotencyActorKeyIndexName,
                   StringComparison.Ordinal);
    }

}
