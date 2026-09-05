using System.Globalization;
using System.Resources;

namespace GymCrm.Application.UserFacingText;

internal static class ClientMembershipText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Application.UserFacingText.Resources.ClientMembershipText",
        typeof(ClientMembershipText).Assembly);

    public static string ClientMembershipTargetPolicyLine63e59186fa => GetString(nameof(ClientMembershipTargetPolicyLine63e59186fa));
    public static string ClientMembershipTargetPolicyLine686a88c317 => GetString(nameof(ClientMembershipTargetPolicyLine686a88c317));
    public static string ClientMembershipTargetPolicyLine73def85203 => GetString(nameof(ClientMembershipTargetPolicyLine73def85203));
    public static string ClientMembershipTargetPolicyLine84fec81fab => GetString(nameof(ClientMembershipTargetPolicyLine84fec81fab));
    public static string ClientMembershipTargetPolicyLine93ff3ce397 => GetString(nameof(ClientMembershipTargetPolicyLine93ff3ce397));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
