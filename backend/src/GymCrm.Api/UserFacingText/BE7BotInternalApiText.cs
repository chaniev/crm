using System.Globalization;
using System.Resources;

namespace GymCrm.Api.UserFacingText;

internal static class BE7BotInternalApiText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.UserFacingText.Resources.BE7BotInternalApiText",
        typeof(BE7BotInternalApiText).Assembly);

    public static string BotInternalEndpointsLine114512cc5e3 => GetString(nameof(BotInternalEndpointsLine114512cc5e3));
    public static string BotInternalEndpointsLine137512cc5e3 => GetString(nameof(BotInternalEndpointsLine137512cc5e3));
    public static string BotInternalEndpointsLine161Ab7c6d65 => GetString(nameof(BotInternalEndpointsLine161Ab7c6d65));
    public static string BotInternalEndpointsLine184512cc5e3 => GetString(nameof(BotInternalEndpointsLine184512cc5e3));
    public static string BotInternalEndpointsLine1931584a20b => GetString(nameof(BotInternalEndpointsLine1931584a20b));
    public static string BotInternalEndpointsLine224Ab7c6d65 => GetString(nameof(BotInternalEndpointsLine224Ab7c6d65));
    public static string BotInternalEndpointsLine2331584a20b => GetString(nameof(BotInternalEndpointsLine2331584a20b));
    public static string BotInternalEndpointsLine3281584a20b => GetString(nameof(BotInternalEndpointsLine3281584a20b));
    public static string BotInternalEndpointsLine356Ea11992e => GetString(nameof(BotInternalEndpointsLine356Ea11992e));
    public static string BotInternalEndpointsLine360D01e6571 => GetString(nameof(BotInternalEndpointsLine360D01e6571));
    public static string BotInternalEndpointsLine364F7451b01 => GetString(nameof(BotInternalEndpointsLine364F7451b01));
    public static string BotInternalEndpointsLine3691cd5b8f3 => GetString(nameof(BotInternalEndpointsLine3691cd5b8f3));
    public static string BotInternalEndpointsLine3759dc0b53c => GetString(nameof(BotInternalEndpointsLine3759dc0b53c));
    public static string BotInternalEndpointsLine3802642715d => GetString(nameof(BotInternalEndpointsLine3802642715d));
    public static string BotInternalEndpointsLine3843ee05d1f => GetString(nameof(BotInternalEndpointsLine3843ee05d1f));
    public static string BotInternalEndpointsLine388E7d11beb => GetString(nameof(BotInternalEndpointsLine388E7d11beb));
    public static string BotInternalEndpointsLine392A6463b42 => GetString(nameof(BotInternalEndpointsLine392A6463b42));
    public static string BotInternalEndpointsLine546aec8af2 => GetString(nameof(BotInternalEndpointsLine546aec8af2));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
