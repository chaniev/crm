using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace GymCrm.Api.Auth;

internal static class AuthSessionDefaults
{
    private const string CookieSecurePolicyConfigurationKey = "Auth:CookieSecurePolicy";

    public static CookieSecurePolicy ResolveCookieSecurePolicy(
        IHostEnvironment environment,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(environment);
        ArgumentNullException.ThrowIfNull(configuration);

        var configuredValue = configuration[CookieSecurePolicyConfigurationKey];
        if (Enum.TryParse<CookieSecurePolicy>(configuredValue, ignoreCase: true, out var configuredPolicy))
        {
            return configuredPolicy;
        }

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
