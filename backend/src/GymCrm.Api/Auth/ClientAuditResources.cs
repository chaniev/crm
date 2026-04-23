using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class ClientAuditResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.ClientAuditResources",
        typeof(ClientAuditResources).Assembly);

    public static string ClientCreatedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientCreatedDescription), actorLogin, clientFullName);
    }

    public static string ClientUpdatedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientUpdatedDescription), actorLogin, clientFullName);
    }

    public static string ClientArchivedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientArchivedDescription), actorLogin, clientFullName);
    }

    public static string ClientRestoredDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientRestoredDescription), actorLogin, clientFullName);
    }

    public static string MembershipPurchasedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipPurchasedDescription), actorLogin, clientFullName);
    }

    public static string MembershipRenewedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipRenewedDescription), actorLogin, clientFullName);
    }

    public static string MembershipCorrectedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipCorrectedDescription), actorLogin, clientFullName);
    }

    public static string MembershipPaymentMarkedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipPaymentMarkedDescription), actorLogin, clientFullName);
    }

    private static string Format(string name, params object[] args)
    {
        return string.Format(CultureInfo.CurrentCulture, GetString(name), args);
    }

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
