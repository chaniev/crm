using System.Globalization;
using System.Resources;

namespace GymCrm.Infrastructure.UserFacingText;

internal static class ClientMembershipText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Infrastructure.UserFacingText.Resources.ClientMembershipText",
        typeof(ClientMembershipText).Assembly);

    public static string ClientMembershipTargetTransferServiceLine1123e0cd008 => GetString(nameof(ClientMembershipTargetTransferServiceLine1123e0cd008));
    public static string ClientMembershipTargetTransferServiceLine130e0ff8ae2 => GetString(nameof(ClientMembershipTargetTransferServiceLine130e0ff8ae2));
    public static string ClientMembershipTargetTransferServiceLine1383f391c77 => GetString(nameof(ClientMembershipTargetTransferServiceLine1383f391c77));
    public static string ClientMembershipTargetTransferServiceLine1755972fb79 => GetString(nameof(ClientMembershipTargetTransferServiceLine1755972fb79));
    public static string ClientMembershipTargetTransferServiceLine188ce8cefa6 => GetString(nameof(ClientMembershipTargetTransferServiceLine188ce8cefa6));
    public static string ClientMembershipTargetTransferServiceLine2297fb85c53 => GetString(nameof(ClientMembershipTargetTransferServiceLine2297fb85c53));
    public static string ClientMembershipTargetTransferServiceLine23061297a89 => GetString(nameof(ClientMembershipTargetTransferServiceLine23061297a89));
    public static string ClientMembershipTargetTransferServiceLine252bcc26641 => GetString(nameof(ClientMembershipTargetTransferServiceLine252bcc26641));
    public static string ClientMembershipTargetTransferServiceLine2600cbf1777 => GetString(nameof(ClientMembershipTargetTransferServiceLine2600cbf1777));
    public static string ClientMembershipTargetTransferServiceLine268f91f4249 => GetString(nameof(ClientMembershipTargetTransferServiceLine268f91f4249));
    public static string ClientMembershipTargetTransferServiceLine2769aa45702 => GetString(nameof(ClientMembershipTargetTransferServiceLine2769aa45702));
    public static string ClientMembershipTargetTransferServiceLine2856fff9be9 => GetString(nameof(ClientMembershipTargetTransferServiceLine2856fff9be9));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
