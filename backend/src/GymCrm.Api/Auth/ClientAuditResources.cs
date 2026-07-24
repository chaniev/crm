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

    public static string ClientNoteChangedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientNoteChangedDescription), actorLogin, clientFullName);
    }

    public static string ClientArchivedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientArchivedDescription), actorLogin, clientFullName);
    }

    public static string ClientRestoredDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientRestoredDescription), actorLogin, clientFullName);
    }

    public static string ClientTransferredDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(ClientTransferredDescription), actorLogin, clientFullName);
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

    public static string MembershipSaleCorrectedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipSaleCorrectedDescription), actorLogin, clientFullName);
    }

    public static string MembershipRefundCreatedDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipRefundCreatedDescription), actorLogin, clientFullName);
    }

    public static string MembershipRefundCanceledDescription(string actorLogin, string clientFullName)
    {
        return Format(nameof(MembershipRefundCanceledDescription), actorLogin, clientFullName);
    }

    public static string MembershipCommentChangedDescription(string actorLogin)
    {
        return Format(nameof(MembershipCommentChangedDescription), actorLogin);
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
