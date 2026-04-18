using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal static class AuthHttpContextExtensions
{
    public static User? GetAuthenticatedGymCrmUser(this HttpContext httpContext)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        return httpContext.Items.TryGetValue(AuthConstants.AuthenticatedUserItemKey, out var value)
            ? value as User
            : null;
    }
}
