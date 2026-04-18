namespace GymCrm.Api.Auth;

internal static class AuthConstants
{
    public const string CookieScheme = "GymCrmCookieAuth";
    public const string AuthCookieName = "gym-crm.auth";
    public const string CsrfCookieName = "gym-crm.csrf";
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
    public const string LoginClaimType = "gym-crm:login";
    public const string UserVersionClaimType = "gym-crm:user-version";
    public const string AuthenticatedUserItemKey = "gym-crm:authenticated-user";
    public const string InvalidCsrfProblemTitle = "InvalidCsrfToken";
    public const string InvalidCsrfProblemDetail =
        "Запрос отклонен из-за некорректного CSRF-токена. Обновите страницу и повторите действие.";
    public const string PasswordChangeRequiredProblemTitle = "PasswordChangeRequired";
    public const string PasswordChangeRequiredProblemDetail =
        "Сначала смените пароль, чтобы продолжить работу.";

    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);
}
