using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class ScheduleMutationTokenClaimPolicy
{
    public static async Task<ScheduleMutationTokenClaimResult> ClaimAsync(
        GymCrmDbContext dbContext,
        ScheduleMutationConfirmationToken token,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (token.ConsumedAt is not null)
        {
            return ScheduleMutationTokenClaimResult.Invalid;
        }

        if (token.ExpiresAt <= now)
        {
            return ScheduleMutationTokenClaimResult.Expired;
        }

        if (UseAtomicRelationalClaim(dbContext))
        {
            var updated = await dbContext.ScheduleMutationConfirmationTokens
                .Where(candidate =>
                    candidate.Id == token.Id &&
                    candidate.ConsumedAt == null &&
                    candidate.ExpiresAt > now)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(candidate => candidate.ConsumedAt, now),
                    cancellationToken);
            if (updated != 1)
            {
                return ScheduleMutationTokenClaimResult.Invalid;
            }

            dbContext.Entry(token).State = EntityState.Detached;
            return ScheduleMutationTokenClaimResult.Claimed;
        }

        token.ConsumedAt = now;
        return ScheduleMutationTokenClaimResult.Claimed;
    }

    private static bool UseAtomicRelationalClaim(GymCrmDbContext dbContext)
    {
        var providerName = dbContext.Database.ProviderName;
        return dbContext.Database.IsRelational() &&
            (providerName is null || !providerName.Contains("Sqlite", StringComparison.OrdinalIgnoreCase));
    }
}

internal enum ScheduleMutationTokenClaimResult
{
    Claimed,
    Invalid,
    Expired
}
