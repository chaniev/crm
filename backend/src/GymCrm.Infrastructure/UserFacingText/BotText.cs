using System.Globalization;
using System.Resources;

namespace GymCrm.Infrastructure.UserFacingText;

internal static class BotText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Infrastructure.UserFacingText.Resources.BotText",
        typeof(BotText).Assembly);

    public static string BotApiServiceLine11285f43e5f1 => GetString(nameof(BotApiServiceLine11285f43e5f1));
    public static string BotApiServiceLine1129f9344282 => GetString(nameof(BotApiServiceLine1129f9344282));
    public static string BotApiServiceLine113081484e50 => GetString(nameof(BotApiServiceLine113081484e50));
    public static string BotApiServiceLine11345f43e5f1 => GetString(nameof(BotApiServiceLine11345f43e5f1));
    public static string BotApiServiceLine1135f9344282 => GetString(nameof(BotApiServiceLine1135f9344282));
    public static string BotApiServiceLine113681484e50 => GetString(nameof(BotApiServiceLine113681484e50));
    public static string BotApiServiceLine11405f43e5f1 => GetString(nameof(BotApiServiceLine11405f43e5f1));
    public static string BotApiServiceLine1141f9344282 => GetString(nameof(BotApiServiceLine1141f9344282));
    public static string BotApiServiceLine11554f342e03 => GetString(nameof(BotApiServiceLine11554f342e03));
    public static string BotApiServiceLine1160b06268ca => GetString(nameof(BotApiServiceLine1160b06268ca));
    public static string BotApiServiceLine1255b0e5ed19 => GetString(nameof(BotApiServiceLine1255b0e5ed19));
    public static string BotApiServiceLine1257ef2f1afb => GetString(nameof(BotApiServiceLine1257ef2f1afb));
    public static string BotApiServiceLine1318d13b909e(object? value0) => Format(nameof(BotApiServiceLine1318d13b909e), value0);
    public static string BotApiServiceLine14443ee05d1f => GetString(nameof(BotApiServiceLine14443ee05d1f));
    public static string BotApiServiceLine1452027fb5dc => GetString(nameof(BotApiServiceLine1452027fb5dc));
    public static string BotApiServiceLine1457cc00242d => GetString(nameof(BotApiServiceLine1457cc00242d));
    public static string BotApiServiceLine1462623985c4 => GetString(nameof(BotApiServiceLine1462623985c4));
    public static string BotApiServiceLine14657fdd2e77 => GetString(nameof(BotApiServiceLine14657fdd2e77));
    public static string BotApiServiceLine1487277d3a37 => GetString(nameof(BotApiServiceLine1487277d3a37));
    public static string BotApiServiceLine40083588c51 => GetString(nameof(BotApiServiceLine40083588c51));
    public static string BotApiServiceLine459459f4ac6 => GetString(nameof(BotApiServiceLine459459f4ac6));
    public static string BotApiServiceLine468b0e5ed19 => GetString(nameof(BotApiServiceLine468b0e5ed19));
    public static string BotApiServiceLine47244fbf4c2 => GetString(nameof(BotApiServiceLine47244fbf4c2));
    public static string BotApiServiceLine494ef2f1afb => GetString(nameof(BotApiServiceLine494ef2f1afb));
    public static string BotApiServiceLine496b0e5ed19 => GetString(nameof(BotApiServiceLine496b0e5ed19));
    public static string BotApiServiceLine529be3a74eb(object? value0, object? value1, object? value2) => Format(nameof(BotApiServiceLine529be3a74eb), value0, value1, value2);
    public static string BotApiServiceLine592bd0975b8(object? value0) => Format(nameof(BotApiServiceLine592bd0975b8), value0);
    public static string BotApiServiceLine863f0c57b5b(object? value0, object? value1) => Format(nameof(BotApiServiceLine863f0c57b5b), value0, value1);

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
