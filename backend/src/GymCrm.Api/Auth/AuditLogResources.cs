using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class AuditLogResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.AuditLogResources",
        typeof(AuditLogResources).Assembly);

    public static string DateMustUseFormat(string dateFormat)
    {
        return Format(nameof(DateMustUseFormat), dateFormat);
    }

    public static string DateToCannotBeBeforeDateFrom => GetString(nameof(DateToCannotBeBeforeDateFrom));

    public static string UserIdInvalid => GetString(nameof(UserIdInvalid));

    public static string PageMustBeGreaterThanZero => GetString(nameof(PageMustBeGreaterThanZero));

    public static string PageSizeMustBeInRange(int maxTake)
    {
        return Format(nameof(PageSizeMustBeInRange), maxTake);
    }

    public static string SkipCannotBeNegative => GetString(nameof(SkipCannotBeNegative));

    public static string TakeMustBeInRange(int maxTake)
    {
        return Format(nameof(TakeMustBeInRange), maxTake);
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
