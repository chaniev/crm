namespace Crm.Api.Auth;

internal static class AuthConstants
{
    public const string CookieScheme = "CrmCookieAuth";
    public const string AuthCookieName = "crm.auth";
    public const string CsrfCookieName = "crm.csrf";
    public const string CsrfHeaderName = "X-CSRF-TOKEN";
    public const string LoginClaimType = "crm:login";
    public const string UserVersionClaimType = "crm:user-version";
    public const string AuthenticatedUserItemKey = "crm:authenticated-user";
}
