using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Api.Startup;

internal static class LoginIdentityStartupExtensions
{
    private const string ApplyMigrationsOnStartupConfigurationKey = "Persistence:ApplyMigrationsOnStartup";
    private const string NormalizedLoginKeyColumnMigration = "20260901120000_AddNormalizedLoginKeyColumn";
    private const string CaseInsensitiveLoginBarrierMigration = "20260901120001_RequireCaseInsensitiveLoginIdentity";

    /// <summary>
    /// Runs the login identity upgrade preparation inside the startup migration
    /// flow: applies the nullable normalized-key column, then backfills and
    /// verifies the keys with the domain contract. The final migration that
    /// installs the case-insensitive unique barrier is applied by the regular
    /// persistence startup flow afterwards. On a retained database with
    /// case-colliding logins this step stops startup with an actionable
    /// collision diagnostic before any uniqueness contract changes.
    /// </summary>
    public static async Task PrepareLoginIdentityUpgradeAsync(
        this WebApplication app,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(app);

        var logger = app.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GymCrm.Api.LoginIdentityUpgrade");

        if (!app.Configuration.GetValue(ApplyMigrationsOnStartupConfigurationKey, true))
        {
            logger.LogDebug(
                "Login identity upgrade preparation is disabled via configuration key '{ConfigurationKey}'.",
                ApplyMigrationsOnStartupConfigurationKey);

            return;
        }

        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var appliedMigrations = (await dbContext.Database.GetAppliedMigrationsAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        // Targeting the intermediate migration after the final barrier is installed
        // would downgrade it (and any later migrations) on every application restart.
        if (appliedMigrations.Contains(CaseInsensitiveLoginBarrierMigration))
        {
            return;
        }

        if (!appliedMigrations.Contains(NormalizedLoginKeyColumnMigration))
        {
            var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
            await migrator.MigrateAsync(NormalizedLoginKeyColumnMigration, cancellationToken);
        }

        await LoginIdentityBackfill.ReconcileAsync(dbContext, cancellationToken);

        logger.LogInformation("Login identity keys are synchronized for the case-insensitive login upgrade.");
    }
}
