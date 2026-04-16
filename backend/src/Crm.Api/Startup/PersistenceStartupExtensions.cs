using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Crm.Api.Startup;

internal static class PersistenceStartupExtensions
{
    private const string ApplyMigrationsOnStartupConfigurationKey = "Persistence:ApplyMigrationsOnStartup";
    private const string FailStartupOnMigrationErrorConfigurationKey = "Persistence:FailStartupOnMigrationError";
    private const string DbContextTypeName = "Microsoft.EntityFrameworkCore.DbContext, Microsoft.EntityFrameworkCore";
    private const string DatabaseFacadeTypeName = "Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade, Microsoft.EntityFrameworkCore";
    private const string RelationalFacadeExtensionsTypeName = "Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions, Microsoft.EntityFrameworkCore.Relational";

    public static async Task ApplyPersistenceStartupFlowAsync(
        this WebApplication app,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(app);

        var logger = app.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("Crm.Api.PersistenceStartup");

        if (!app.Configuration.GetValue(ApplyMigrationsOnStartupConfigurationKey, true))
        {
            logger.LogInformation(
                "Persistence startup flow is disabled via configuration key '{ConfigurationKey}'.",
                ApplyMigrationsOnStartupConfigurationKey);

            return;
        }

        var dbContextType = Type.GetType(DbContextTypeName);
        var databaseFacadeType = Type.GetType(DatabaseFacadeTypeName);
        var relationalExtensionsType = Type.GetType(RelationalFacadeExtensionsTypeName);
        var migrateAsyncMethod = FindMigrateAsyncMethod(databaseFacadeType, relationalExtensionsType);

        if (dbContextType is null || databaseFacadeType is null || migrateAsyncMethod is null)
        {
            logger.LogDebug(
                "EF Core relational migration APIs are not available yet. Skipping migration startup flow.");

            return;
        }

        var dbContextTypes = DiscoverDbContextTypes(dbContextType);
        if (dbContextTypes.Count == 0)
        {
            logger.LogDebug(
                "No DbContext types were discovered in loaded CRM assemblies. Skipping migration startup flow.");

            return;
        }

        using var scope = app.Services.CreateScope();
        var failStartupOnMigrationError = app.Configuration.GetValue(
            FailStartupOnMigrationErrorConfigurationKey,
            true);

        foreach (var contextType in dbContextTypes)
        {
            var dbContext = scope.ServiceProvider.GetService(contextType);
            if (dbContext is null)
            {
                logger.LogDebug(
                    "DbContext type '{DbContextType}' was discovered but is not registered in DI. Skipping.",
                    contextType.FullName);

                continue;
            }

            var databaseFacade = contextType.GetProperty("Database")?.GetValue(dbContext);
            if (databaseFacade is null || !databaseFacadeType.IsInstanceOfType(databaseFacade))
            {
                logger.LogWarning(
                    "DbContext type '{DbContextType}' does not expose a relational Database facade. Skipping.",
                    contextType.FullName);

                continue;
            }

            try
            {
                logger.LogInformation(
                    "Applying pending migrations for DbContext '{DbContextType}'.",
                    contextType.FullName);

                var migrationTask = migrateAsyncMethod.Invoke(null, [databaseFacade, cancellationToken]) as Task;
                if (migrationTask is null)
                {
                    throw new InvalidOperationException(
                        $"Could not invoke MigrateAsync for DbContext '{contextType.FullName}'.");
                }

                await migrationTask.ConfigureAwait(false);

                logger.LogInformation(
                    "Persistence startup flow completed for DbContext '{DbContextType}'.",
                    contextType.FullName);
            }
            catch (Exception exception)
            {
                var actualException = exception is TargetInvocationException { InnerException: not null }
                    ? exception.InnerException
                    : exception;

                logger.LogError(
                    actualException,
                    "Failed to apply pending migrations for DbContext '{DbContextType}'.",
                    contextType.FullName);

                if (failStartupOnMigrationError)
                {
                    throw;
                }
            }
        }
    }

    private static MethodInfo? FindMigrateAsyncMethod(Type? databaseFacadeType, Type? relationalExtensionsType)
    {
        if (databaseFacadeType is null || relationalExtensionsType is null)
        {
            return null;
        }

        return relationalExtensionsType
            .GetMethods(BindingFlags.Public | BindingFlags.Static)
            .SingleOrDefault(method =>
            {
                if (!string.Equals(method.Name, "MigrateAsync", StringComparison.Ordinal))
                {
                    return false;
                }

                var parameters = method.GetParameters();
                return parameters.Length == 2 &&
                    parameters[0].ParameterType == databaseFacadeType &&
                    parameters[1].ParameterType == typeof(CancellationToken);
            });
    }

    private static IReadOnlyList<Type> DiscoverDbContextTypes(Type dbContextType)
    {
        return AppDomain.CurrentDomain
            .GetAssemblies()
            .Where(assembly =>
                !assembly.IsDynamic &&
                assembly.GetName().Name?.StartsWith("Crm.", StringComparison.Ordinal) == true)
            .SelectMany(SafeGetTypes)
            .Where(type =>
                type.IsClass &&
                !type.IsAbstract &&
                dbContextType.IsAssignableFrom(type))
            .Distinct()
            .ToArray();
    }

    private static IEnumerable<Type> SafeGetTypes(Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException exception)
        {
            return exception.Types.Where(type => type is not null).OfType<Type>();
        }
    }
}
