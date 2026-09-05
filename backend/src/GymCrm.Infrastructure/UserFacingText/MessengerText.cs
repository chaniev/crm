using System.Globalization;
using System.Resources;

namespace GymCrm.Infrastructure.UserFacingText;

internal static class MessengerText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Infrastructure.UserFacingText.Resources.MessengerText",
        typeof(MessengerText).Assembly);

    public static string ClientMessengerServiceLine115031477b7 => GetString(nameof(ClientMessengerServiceLine115031477b7));
    public static string ClientMessengerServiceLine11631ddcfb7 => GetString(nameof(ClientMessengerServiceLine11631ddcfb7));
    public static string ClientMessengerServiceLine1173f51de60 => GetString(nameof(ClientMessengerServiceLine1173f51de60));
    public static string ClientMessengerServiceLine12860160b1c => GetString(nameof(ClientMessengerServiceLine12860160b1c));
    public static string ClientMessengerServiceLine267604d2663 => GetString(nameof(ClientMessengerServiceLine267604d2663));
    public static string ClientMessengerServiceLine2751f021fc3 => GetString(nameof(ClientMessengerServiceLine2751f021fc3));
    public static string ClientMessengerServiceLine731a2756241 => GetString(nameof(ClientMessengerServiceLine731a2756241));
    public static string ClientMessengerServiceLine735972050d1(object? value0) => Format(nameof(ClientMessengerServiceLine735972050d1), value0);
    public static string ClientMessengerServiceLine740b39d76fa => GetString(nameof(ClientMessengerServiceLine740b39d76fa));
    public static string ClientMessengerServiceLine78575463f01 => GetString(nameof(ClientMessengerServiceLine78575463f01));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
