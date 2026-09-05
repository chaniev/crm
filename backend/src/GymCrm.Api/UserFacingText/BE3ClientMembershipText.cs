using System.Globalization;
using System.Resources;

namespace GymCrm.Api.UserFacingText;

internal static class BE3ClientMembershipText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.UserFacingText.Resources.BE3ClientMembershipText",
        typeof(BE3ClientMembershipText).Assembly);

    public static string ClientMembershipEndpointsLine1243117a1d9 => GetString(nameof(ClientMembershipEndpointsLine1243117a1d9));
    public static string ClientMembershipEndpointsLine1374E266e0bf => GetString(nameof(ClientMembershipEndpointsLine1374E266e0bf));
    public static string ClientMembershipEndpointsLine4088cf17618 => GetString(nameof(ClientMembershipEndpointsLine4088cf17618));
    public static string ClientMembershipEndpointsLine5183eeff138 => GetString(nameof(ClientMembershipEndpointsLine5183eeff138));
    public static string ClientMembershipEndpointsLine527339319fd => GetString(nameof(ClientMembershipEndpointsLine527339319fd));
    public static string ClientMembershipEndpointsLine584339319fd => GetString(nameof(ClientMembershipEndpointsLine584339319fd));
    public static string ClientMembershipEndpointsLine63016aaa323(object? value0, object? value1) => Format(nameof(ClientMembershipEndpointsLine63016aaa323), value0, value1);
    public static string ClientMembershipEndpointsLine6611c294390 => GetString(nameof(ClientMembershipEndpointsLine6611c294390));
    public static string ClientMembershipEndpointsLine69145ea1663 => GetString(nameof(ClientMembershipEndpointsLine69145ea1663));
    public static string ClientMembershipEndpointsLine702E708b0d9 => GetString(nameof(ClientMembershipEndpointsLine702E708b0d9));
    public static string ClientMembershipEndpointsLine7293e0cd008 => GetString(nameof(ClientMembershipEndpointsLine7293e0cd008));
    public static string ClientMembershipEndpointsLine8792a8c74ae => GetString(nameof(ClientMembershipEndpointsLine8792a8c74ae));
    public static string ClientMembershipEndpointsLine9203eeff138 => GetString(nameof(ClientMembershipEndpointsLine9203eeff138));
    public static string ClientMembershipEndpointsLine929339319fd => GetString(nameof(ClientMembershipEndpointsLine929339319fd));
    public static string ClientMembershipRequestValidationLine10413f4bf32 => GetString(nameof(ClientMembershipRequestValidationLine10413f4bf32));
    public static string ClientMembershipRequestValidationLine151E5272767 => GetString(nameof(ClientMembershipRequestValidationLine151E5272767));
    public static string ClientMembershipRequestValidationLine154264b3a42 => GetString(nameof(ClientMembershipRequestValidationLine154264b3a42));
    public static string ClientMembershipRequestValidationLine165E59186fa => GetString(nameof(ClientMembershipRequestValidationLine165E59186fa));
    public static string ClientMembershipRequestValidationLine1716a88c317 => GetString(nameof(ClientMembershipRequestValidationLine1716a88c317));
    public static string ClientMembershipRequestValidationLine17862a0a730 => GetString(nameof(ClientMembershipRequestValidationLine17862a0a730));
    public static string ClientMembershipRequestValidationLine184Fec81fab => GetString(nameof(ClientMembershipRequestValidationLine184Fec81fab));
    public static string ClientMembershipRequestValidationLine198502b7239 => GetString(nameof(ClientMembershipRequestValidationLine198502b7239));
    public static string ClientMembershipRequestValidationLine31962a0a730 => GetString(nameof(ClientMembershipRequestValidationLine31962a0a730));
    public static string ClientMembershipRequestValidationLine52D2ba0831 => GetString(nameof(ClientMembershipRequestValidationLine52D2ba0831));
    public static string ClientMembershipRequestValidationLine57Beebccea => GetString(nameof(ClientMembershipRequestValidationLine57Beebccea));
    public static string ClientMembershipRequestValidationLine99E2a18a30 => GetString(nameof(ClientMembershipRequestValidationLine99E2a18a30));
    public static string MembershipCatalogEndpointsLine1252f820c7b => GetString(nameof(MembershipCatalogEndpointsLine1252f820c7b));
    public static string MembershipCatalogEndpointsLine70C1553788 => GetString(nameof(MembershipCatalogEndpointsLine70C1553788));
    public static string MembershipCatalogEndpointsLine7251d079c0 => GetString(nameof(MembershipCatalogEndpointsLine7251d079c0));
    public static string MembershipCatalogEndpointsLine9572de6d77 => GetString(nameof(MembershipCatalogEndpointsLine9572de6d77));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}