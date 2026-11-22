using System.Globalization;
using System.Security.Claims;
using GymCrm.Domain.Users;
using Microsoft.AspNetCore.Authentication;

namespace GymCrm.Api.Auth;

internal static class AuthSessionSync
{
    public static string FormatUserVersion(DateTimeOffset updatedAt)
    {
        return updatedAt.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
    }

    public static bool CredentialVersionMatches(ClaimsPrincipal principal, User user) =>
        string.Equals(principal.FindFirstValue(AuthConstants.CredentialVersionClaimType),
            user.CredentialVersion?.ToString(), StringComparison.Ordinal);

    public static bool IsCurrentSession(ClaimsPrincipal principal, User user) =>
        user.IsActive && CredentialVersionMatches(principal, user) &&
        string.Equals(principal.FindFirstValue(AuthConstants.UserVersionClaimType),
            FormatUserVersion(user.UpdatedAt), StringComparison.Ordinal);

    public static ClaimsPrincipal CreatePrincipal(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new(AuthConstants.LoginClaimType, user.Login),
            new(AuthConstants.UserVersionClaimType, FormatUserVersion(user.UpdatedAt))
        };

        if (user.CredentialVersion is { } version)
        {
            claims.Add(new Claim(AuthConstants.CredentialVersionClaimType, version.ToString()));
        }

        var identity = new ClaimsIdentity(
            claims,
            AuthConstants.CookieScheme,
            ClaimTypes.Name,
            ClaimTypes.Role);

        return new ClaimsPrincipal(identity);
    }

    public static async Task SignInAsync(
        HttpContext httpContext,
        User user,
        DateTimeOffset? issuedAt = null)
    {
        var principal = CreatePrincipal(user);

        await httpContext.SignInAsync(
            AuthConstants.CookieScheme,
            principal,
            AuthSessionDefaults.CreateAuthenticationProperties(issuedAt));

        httpContext.User = principal;
        httpContext.Items[AuthConstants.AuthenticatedUserItemKey] = user;
    }

    public static async Task SignOutAsync(HttpContext httpContext)
    {
        await httpContext.SignOutAsync(AuthConstants.CookieScheme);
        httpContext.Items.Remove(AuthConstants.AuthenticatedUserItemKey);
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
    }

    public static Task SyncCurrentSessionAsync(HttpContext httpContext, User user)
    {
        return user.IsActive
            ? SignInAsync(httpContext, user, user.UpdatedAt)
            : SignOutAsync(httpContext);
    }
}
