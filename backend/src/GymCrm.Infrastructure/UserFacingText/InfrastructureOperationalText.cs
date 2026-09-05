using System.Globalization;
using System.Resources;

namespace GymCrm.Infrastructure.UserFacingText;

internal static class InfrastructureOperationalText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Infrastructure.UserFacingText.Resources.InfrastructureOperationalText",
        typeof(InfrastructureOperationalText).Assembly);

    public static string AdministratorAttendanceGroupGrantServiceLine350D50fc303 => GetString(nameof(AdministratorAttendanceGroupGrantServiceLine350D50fc303));
    public static string AdministratorAttendanceGroupGrantServiceLine355D50fc303 => GetString(nameof(AdministratorAttendanceGroupGrantServiceLine355D50fc303));
    public static string AttendanceTransitionServiceLine2466f693631 => GetString(nameof(AttendanceTransitionServiceLine2466f693631));
    public static string AttendanceTransitionServiceLine414C059f91d => GetString(nameof(AttendanceTransitionServiceLine414C059f91d));
    public static string AttendanceTransitionServiceLine629Feab3b2e => GetString(nameof(AttendanceTransitionServiceLine629Feab3b2e));
    public static string AttendanceTransitionServiceLine941B4977fca => GetString(nameof(AttendanceTransitionServiceLine941B4977fca));
    public static string BotApiServiceLine832C2fbee88 => GetString(nameof(BotApiServiceLine832C2fbee88));
    public static string ClientMembershipDetailsReaderLine347880ea76(object? value0) => Format(nameof(ClientMembershipDetailsReaderLine347880ea76), value0);
    public static string ClientMembershipDetailsReaderLine447880ea76(object? value0) => Format(nameof(ClientMembershipDetailsReaderLine447880ea76), value0);
    public static string ClientMembershipDetailsReaderLine557880ea76(object? value0) => Format(nameof(ClientMembershipDetailsReaderLine557880ea76), value0);
    public static string ClientMessengerServiceLine16872d9a2ed(object? value0) => Format(nameof(ClientMessengerServiceLine16872d9a2ed), value0);
    public static string ClientMessengerServiceLine30366461baa(object? value0) => Format(nameof(ClientMessengerServiceLine30366461baa), value0);
    public static string ClientMessengerServiceLine368A1dab490(object? value0) => Format(nameof(ClientMessengerServiceLine368A1dab490), value0);
    public static string ClientMessengerServiceLine5350e41c90d => GetString(nameof(ClientMessengerServiceLine5350e41c90d));
    public static string ClientMessengerServiceLine7159ac7fc45 => GetString(nameof(ClientMessengerServiceLine7159ac7fc45));
    public static string ClientMessengerServiceLine720626a2373(object? value0) => Format(nameof(ClientMessengerServiceLine720626a2373), value0);
    public static string ClientTelegramBotApiTransportLine157Ab3a6efa => GetString(nameof(ClientTelegramBotApiTransportLine157Ab3a6efa));
    public static string ClientTelegramBotApiTransportLine1917e219538 => GetString(nameof(ClientTelegramBotApiTransportLine1917e219538));
    public static string ClientTelegramBotApiTransportLine195D094d7d0 => GetString(nameof(ClientTelegramBotApiTransportLine195D094d7d0));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}