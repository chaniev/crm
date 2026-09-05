using System.Globalization;
using System.Resources;

namespace GymCrm.Infrastructure.UserFacingText;

internal static class AttendanceText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Infrastructure.UserFacingText.Resources.AttendanceText",
        typeof(AttendanceText).Assembly);

    public static string AttendanceServiceLine617277d3a37 => GetString(nameof(AttendanceServiceLine617277d3a37));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
