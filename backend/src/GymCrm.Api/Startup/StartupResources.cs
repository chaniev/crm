using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Startup;

internal static class StartupResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Startup.Resources.StartupResources",
        typeof(StartupResources).Assembly);

    public static string SelfHealthCheckDescription => GetString(nameof(SelfHealthCheckDescription));

    public static string BootstrapFullNameDefault => GetString(nameof(BootstrapFullNameDefault));

    public static string BootstrapUserLoginAlreadyExistsLog => GetString(nameof(BootstrapUserLoginAlreadyExistsLog));

    public static string BootstrapUserDatabaseAlreadyHasUsersLog => GetString(nameof(BootstrapUserDatabaseAlreadyHasUsersLog));

    public static string BootstrapUserConcurrentCreationSkippedLog => GetString(nameof(BootstrapUserConcurrentCreationSkippedLog));

    public static string BootstrapUserCreatedLog => GetString(nameof(BootstrapUserCreatedLog));

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
