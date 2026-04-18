namespace Crm.Api.Auth;

internal static class AuthConstants
{
    public const string CookieScheme = "CrmCookieAuth";
    public const string AuthCookieName = "crm.auth";
    public const string CsrfCookieName = "crm.csrf";
    public const string CsrfHeaderName = "X-CSRF-TOKEN";
    public const string AuthRoutePrefix = "/auth";
    public const string SessionRoute = "/session";
    public const string ProfileRoute = "/profile";
    public const string LoginRoute = "/login";
    public const string LogoutRoute = "/logout";
    public const string ChangePasswordRoute = "/change-password";
    public const string SessionPath = AuthRoutePrefix + SessionRoute;
    public const string ProfilePath = AuthRoutePrefix + ProfileRoute;
    public const string LoginPath = AuthRoutePrefix + LoginRoute;
    public const string LogoutPath = AuthRoutePrefix + LogoutRoute;
    public const string ChangePasswordPath = AuthRoutePrefix + ChangePasswordRoute;
    public const string LoginClaimType = "crm:login";
    public const string UserVersionClaimType = "crm:user-version";
    public const string AuthenticatedUserItemKey = "crm:authenticated-user";
    public const string InvalidCsrfProblemTitle = "InvalidCsrfToken";
    public const string InvalidCsrfProblemDetail =
        "Запрос отклонен из-за некорректного CSRF-токена. Обновите страницу и повторите действие.";
    public const string PasswordChangeRequiredProblemTitle = "PasswordChangeRequired";
    public const string PasswordChangeRequiredProblemDetail =
        "Сначала смените пароль, чтобы продолжить работу.";

    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);
}
