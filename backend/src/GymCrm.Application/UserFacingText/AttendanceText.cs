using System.Globalization;
using System.Resources;

namespace GymCrm.Application.UserFacingText;

internal static class AttendanceText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Application.UserFacingText.Resources.AttendanceText",
        typeof(AttendanceText).Assembly);

    public static string AttendanceAuditContractLine17b75586e3(object? value0, object? value1, object? value2, object? value3) => Format(nameof(AttendanceAuditContractLine17b75586e3), value0, value1, value2, value3);
    public static string AttendanceAuditContractLine203cfee4d5(object? value0, object? value1) => Format(nameof(AttendanceAuditContractLine203cfee4d5), value0, value1);
    public static string AttendanceAuditContractLine23a3aea2d3(object? value0, object? value1) => Format(nameof(AttendanceAuditContractLine23a3aea2d3), value0, value1);

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
