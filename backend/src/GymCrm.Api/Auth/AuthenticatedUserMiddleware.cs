using System.Security.Claims;
using GymCrm.Api.Startup;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal sealed class AuthenticatedUserMiddleware(RequestDelegate next)
{
    private static readonly string[] AllowedWhenPasswordChangeRequired =
    [
        ApiHostingConstants.RootPath,
        ApiHostingConstants.ConfigPath,
        AuthConstants.SessionPath,
        AuthConstants.ChangePasswordPath,
        AuthConstants.LogoutPath,
        ApiHostingConstants.LiveHealthPath,
        ApiHostingConstants.ReadyHealthPath
    ];

    public async Task InvokeAsync(HttpContext context, GymCrmDbContext dbContext)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            await AuthSessionSync.SignOutAsync(context);
            await next(context);
            return;
        }

        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, context.RequestAborted);

        if (user is null || !AuthSessionSync.IsCurrentSession(context.User, user))
        {
            // SignOut suppresses sliding renewal. A delayed response for a revoked ticket
            // must also leave any replacement cookie already received by the browser intact.
            var existingCookies = context.Response.Headers.SetCookie;
            await AuthSessionSync.SignOutAsync(context);
            context.Response.Headers.SetCookie = existingCookies;
            await next(context);
            return;
        }

        context.Items[AuthConstants.AuthenticatedUserItemKey] = user;

        if (user.MustChangePassword && !IsAllowedWhilePasswordChangeRequired(context.Request.Path))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                title = AuthConstants.PasswordChangeRequiredProblemTitle,
                detail = AuthResources.PasswordChangeRequiredProblemDetail
            }, context.RequestAborted);

            return;
        }

        await next(context);
    }
    private static bool IsAllowedWhilePasswordChangeRequired(PathString requestPath)
    {
        var path = requestPath.Value ?? string.Empty;

        return AllowedWhenPasswordChangeRequired.Any(allowed =>
            string.Equals(path, allowed, StringComparison.OrdinalIgnoreCase));
    }

}
