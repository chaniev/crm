using System.Globalization;
using System.Resources;

namespace GymCrm.Api.UserFacingText;

internal static class BE4AttendanceText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.UserFacingText.Resources.BE4AttendanceText",
        typeof(BE4AttendanceText).Assembly);

    public static string AttendanceEndpointsLine462B0e5ed19 => GetString(nameof(AttendanceEndpointsLine462B0e5ed19));
    public static string AttendanceEndpointsLine598B0e5ed19 => GetString(nameof(AttendanceEndpointsLine598B0e5ed19));
    public static string AttendanceEndpointsLine781A0d4e31f => GetString(nameof(AttendanceEndpointsLine781A0d4e31f));
    public static string AttendanceEndpointsLine795A47bee81 => GetString(nameof(AttendanceEndpointsLine795A47bee81));
    public static string AttendanceEndpointsLine809Acdeea91 => GetString(nameof(AttendanceEndpointsLine809Acdeea91));
    public static string AttendanceEndpointsLine81084c16769 => GetString(nameof(AttendanceEndpointsLine81084c16769));
    public static string AttendanceValidationProblemsLine20E5c8412a(object? value0) => Format(nameof(AttendanceValidationProblemsLine20E5c8412a), value0);
    public static string AttendanceValidationProblemsLine441cd5b8f3 => GetString(nameof(AttendanceValidationProblemsLine441cd5b8f3));
    public static string AttendanceValidationProblemsLine53Bfcdb657 => GetString(nameof(AttendanceValidationProblemsLine53Bfcdb657));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
