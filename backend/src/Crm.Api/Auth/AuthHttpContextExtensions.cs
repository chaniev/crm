using Crm.Domain.Users;

namespace Crm.Api.Auth;

internal static class AuthHttpContextExtensions
{
    public static User? GetAuthenticatedCrmUser(this HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        return httpContext.Items.TryGetValue(AuthConstants.AuthenticatedUserItemKey, out var value)
            ? value as User
            : null;
    }
}
