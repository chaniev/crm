using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Startup;

internal static class PersistenceStartupExtensions
{
    private const string ApplyMigrationsOnStartupConfigurationKey = "Persistence:ApplyMigrationsOnStartup";
    private const string FailStartupOnMigrationErrorConfigurationKey = "Persistence:FailStartupOnMigrationError";

    public static async Task ApplyPersistenceStartupFlowAsync(
        this WebApplication app,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(app);

        var logger = app.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GymCrm.Api.PersistenceStartup");

        if (!app.Configuration.GetValue(ApplyMigrationsOnStartupConfigurationKey, true))
        {
            logger.LogInformation(
                "Persistence startup flow is disabled via configuration key '{ConfigurationKey}'.",
                ApplyMigrationsOnStartupConfigurationKey);

            return;
        }

        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var failStartupOnMigrationError = app.Configuration.GetValue(
            FailStartupOnMigrationErrorConfigurationKey,
            true);

        try
        {
            logger.LogInformation(
                "Applying pending migrations for DbContext '{DbContextType}'.",
                typeof(GymCrmDbContext).FullName);

            await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);

            logger.LogInformation(
                "Persistence startup flow completed for DbContext '{DbContextType}'.",
                typeof(GymCrmDbContext).FullName);
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Failed to apply pending migrations for DbContext '{DbContextType}'.",
                typeof(GymCrmDbContext).FullName);

            if (failStartupOnMigrationError)
            {
                throw;
            }
        }
    }
}
