using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace GymCrm.Infrastructure.Clients;

internal static class ClientMembershipTransaction
{
    public static async Task<IDbContextTransaction?> BeginIfSupportedAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return dbContext.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory" ||
               dbContext.Database.CurrentTransaction is not null
            ? null
            : await dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    public static async Task CommitIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    public static async Task RollbackIfPresentAsync(
        IDbContextTransaction? transaction,
        CancellationToken cancellationToken)
    {
        if (transaction is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
        }
    }

    public static bool IsMembershipOverlapException(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.ExclusionViolation,
            ConstraintName: "EX_ClientMemberships_ClientId_Period_NoOverlap"
        };
    }
}
