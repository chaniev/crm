using System.Globalization;
using System.Resources;

namespace GymCrm.Domain.UserFacingText;

internal static class ClientMembershipDisplayText
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Domain.UserFacingText.Resources.ClientMembershipDisplayText",
        typeof(ClientMembershipDisplayText).Assembly);

    public static string ClientMembershipSaleDisplayLine592f64d0d => GetString(nameof(ClientMembershipSaleDisplayLine592f64d0d));

    private static string Format(string name, params object?[] args) =>
        string.Format(CultureInfo.CurrentCulture, GetString(name), args);

    private static string GetString(string name) =>
        ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
        ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
}
