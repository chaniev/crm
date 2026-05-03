using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class AccessResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.AccessResources",
        typeof(AccessResources).Assembly);

    public static string UserManagementDetail => GetString(nameof(UserManagementDetail));

    public static string ClientManagementDetail => GetString(nameof(ClientManagementDetail));

    public static string GroupManagementDetail => GetString(nameof(GroupManagementDetail));

    public static string AuditLogDetail => GetString(nameof(AuditLogDetail));

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
