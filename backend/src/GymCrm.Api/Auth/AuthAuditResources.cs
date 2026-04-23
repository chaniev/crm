using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class AuthAuditResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.AuthAuditResources",
        typeof(AuthAuditResources).Assembly);

    public static string LoginDescription(string login)
    {
        return Format(nameof(LoginDescription), login);
    }

    public static string LogoutDescription(string login)
    {
        return Format(nameof(LogoutDescription), login);
    }

    public static string PasswordChangedDescription(string login)
    {
        return Format(nameof(PasswordChangedDescription), login);
    }

    private static string Format(string name, params object[] args)
    {
        return string.Format(CultureInfo.CurrentCulture, GetString(name), args);
    }

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
