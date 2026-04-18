using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Hosting;

namespace GymCrm.Api.Auth;

internal static class AuthSessionDefaults
{
    public static CookieSecurePolicy ResolveCookieSecurePolicy(IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);

        return environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
    }

    public static AuthenticationProperties CreateAuthenticationProperties(DateTimeOffset? issuedAt = null)
    {
        var now = issuedAt ?? DateTimeOffset.UtcNow;

        return new AuthenticationProperties
        {
            AllowRefresh = true,
            ExpiresUtc = now.Add(AuthConstants.SessionLifetime),
            IsPersistent = true,
            IssuedUtc = now
        };
    }
}
