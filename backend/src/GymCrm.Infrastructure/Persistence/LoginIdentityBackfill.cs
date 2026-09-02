using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Persistence;

/// <summary>
/// Backfills and verifies the normalized login identity key of stored users
/// with the same domain <see cref="LoginIdentity"/> contract the application
/// uses, so .NET remains the single authority for the key. A normalized-key
/// collision among stored users stops the upgrade before the case-insensitive
/// uniqueness contract is applied; no row is modified in that case.
/// </summary>
public static class LoginIdentityBackfill
{
    public const string CollisionStopMarker = "case-insensitive-login-collision";

    public static async Task ReconcileAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        var storedLogins = await dbContext.Users
            .Select(user => user.Login)
            .ToListAsync(cancellationToken);
        var collisions = storedLogins
            .GroupBy(LoginIdentity.NormalizeKey, StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .ToArray();
        if (collisions.Length > 0)
        {
            var evidence = string.Join(
                "; ",
                collisions.Select(group => string.Join(
                    "/",
                    group.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal))));
            throw new InvalidOperationException(
                $"{CollisionStopMarker}: cannot apply case-insensitive login uniqueness because existing users "
                + $"collide after normalization: {evidence}. Resolve these accounts before upgrading; "
                + "no data was changed.");
        }

        foreach (var login in storedLogins)
        {
            await dbContext.Users
                .Where(user => user.Login == login)
                .ExecuteUpdateAsync(
                    setter => setter.SetProperty(
                        user => user.LoginNormalized,
                        LoginIdentity.NormalizeKey(login)),
                    cancellationToken);
        }
    }
}
