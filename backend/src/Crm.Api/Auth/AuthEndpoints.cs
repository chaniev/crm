using System.Security.Claims;
using System.Text.Json;
using Crm.Application.Authorization;
using Crm.Application.Audit;
using Crm.Application.Security;
using Crm.Domain.Users;
using Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Crm.Api.Auth;

internal static class AuthEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/auth");

        group.MapGet("/session", GetSessionAsync);
        group.MapGet("/profile", GetProfileAsync).RequireAuthorization();
        group.MapPost("/login", LoginAsync);
        group.MapPost("/logout", LogoutAsync).RequireAuthorization();
        group.MapPost("/change-password", ChangePasswordAsync).RequireAuthorization();

        return endpoints;
    }

    private static async Task<Ok<SessionResponse>> GetSessionAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            cancellationToken: cancellationToken));
    }

    private static async Task<Results<Ok<AuthenticatedUserResponse>, UnauthorizedHttpResult>> GetProfileAsync(
        HttpContext httpContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var user = httpContext.GetAuthenticatedCrmUser();
        return user is null
            ? TypedResults.Unauthorized()
            : TypedResults.Ok(await ToUserResponseAsync(user, accessScopeService, cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ValidationProblem, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var login = request.Login?.Trim();
        if (string.IsNullOrWhiteSpace(login) || string.IsNullOrEmpty(request.Password))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["login"] = ["Укажите логин."],
                ["password"] = ["Укажите пароль."]
            });
        }

        var user = await dbContext.Users
            .SingleOrDefaultAsync(candidate => candidate.Login == login, cancellationToken);

        if (user is null || !user.IsActive || !passwordHashService.VerifyPassword(user, request.Password))
        {
            return TypedResults.Problem(
                title: "InvalidCredentials",
                detail: "Неверный логин или пароль.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                user.Id,
                "Login",
                "UserSession",
                user.Id.ToString(),
                $"User '{user.Login}' signed in."),
            cancellationToken);

        var principal = CreatePrincipal(user);
        await httpContext.SignInAsync(AuthConstants.CookieScheme, principal, CreateAuthenticationProperties());

        httpContext.User = principal;
        httpContext.Items[AuthConstants.AuthenticatedUserItemKey] = user;

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            user,
            cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult, UnauthorizedHttpResult>> LogoutAsync(
        HttpContext httpContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var user = httpContext.GetAuthenticatedCrmUser();
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                user.Id,
                "Logout",
                "UserSession",
                user.Id.ToString(),
                $"User '{user.Login}' signed out."),
            cancellationToken);

        await httpContext.SignOutAsync(AuthConstants.CookieScheme);
        httpContext.Items.Remove(AuthConstants.AuthenticatedUserItemKey);
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            cancellationToken: cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ChangePasswordAsync(
        ChangePasswordRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await ValidateAntiforgeryAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        if (string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentPassword"] = ["Укажите текущий пароль."],
                ["newPassword"] = ["Укажите новый пароль."]
            });
        }

        if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["newPassword"] = ["Новый пароль должен отличаться от текущего."]
            });
        }

        var user = await dbContext.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == currentUser.Id, cancellationToken);

        if (user is null || !user.IsActive)
        {
            return TypedResults.Unauthorized();
        }

        if (!passwordHashService.VerifyPassword(user, request.CurrentPassword))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["currentPassword"] = ["Текущий пароль указан неверно."]
            });
        }

        var oldState = JsonSerializer.Serialize(
            new { user.MustChangePassword },
            AuditSerializerOptions);

        var now = DateTimeOffset.UtcNow;
        user.PasswordHash = passwordHashService.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        var newState = JsonSerializer.Serialize(
            new { user.MustChangePassword },
            AuditSerializerOptions);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                user.Id,
                "PasswordChanged",
                "User",
                user.Id.ToString(),
                $"User '{user.Login}' changed password.",
                oldState,
                newState),
            cancellationToken);

        var principal = CreatePrincipal(user);
        await httpContext.SignInAsync(AuthConstants.CookieScheme, principal, CreateAuthenticationProperties(now));

        httpContext.User = principal;
        httpContext.Items[AuthConstants.AuthenticatedUserItemKey] = user;

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            user,
            cancellationToken));
    }

    private static async Task<ProblemHttpResult?> ValidateAntiforgeryAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(httpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return TypedResults.Problem(
                title: "InvalidCsrfToken",
                detail: "Запрос отклонен из-за некорректного CSRF-токена. Обновите страницу и повторите действие.",
                statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static async Task<SessionResponse> CreateSessionResponseAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        User? authenticatedUser = null,
        CancellationToken cancellationToken = default)
    {
        var user = authenticatedUser ?? httpContext.GetAuthenticatedCrmUser();
        var tokens = antiforgery.GetAndStoreTokens(httpContext);

        return new SessionResponse(
            user is not null,
            tokens.RequestToken ?? string.Empty,
            user is null
                ? null
                : await ToUserResponseAsync(user, accessScopeService, cancellationToken));
    }

    private static async Task<AuthenticatedUserResponse> ToUserResponseAsync(
        User user,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var accessScope = await accessScopeService.GetAccessScopeAsync(user, cancellationToken);

        return new AuthenticatedUserResponse(
            user.Id,
            user.FullName,
            user.Login,
            user.Role.ToString(),
            user.MustChangePassword,
            user.IsActive,
            accessScope.LandingScreen,
            accessScope.AllowedSections,
            new AccessPermissionsResponse(
                accessScope.Permissions.CanManageUsers,
                accessScope.Permissions.CanManageClients,
                accessScope.Permissions.CanManageGroups,
                accessScope.Permissions.CanMarkAttendance,
                accessScope.Permissions.CanViewAuditLog),
            accessScope.AssignedGroupIds);
    }

    private static ClaimsPrincipal CreatePrincipal(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new(AuthConstants.LoginClaimType, user.Login),
            new(AuthConstants.UserVersionClaimType, AuthenticatedUserMiddleware.FormatUserVersion(user.UpdatedAt))
        };

        var identity = new ClaimsIdentity(
            claims,
            AuthConstants.CookieScheme,
            ClaimTypes.Name,
            ClaimTypes.Role);

        return new ClaimsPrincipal(identity);
    }

    private static AuthenticationProperties CreateAuthenticationProperties(DateTimeOffset? issuedAt = null)
    {
        var now = issuedAt ?? DateTimeOffset.UtcNow;

        return new AuthenticationProperties
        {
            AllowRefresh = true,
            ExpiresUtc = now.AddHours(8),
            IsPersistent = true,
            IssuedUtc = now
        };
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    private sealed record SessionResponse(
        bool IsAuthenticated,
        string CsrfToken,
        AuthenticatedUserResponse? User);

    private sealed record AuthenticatedUserResponse(
        Guid Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen,
        IReadOnlyList<string> AllowedSections,
        AccessPermissionsResponse Permissions,
        IReadOnlyList<Guid> AssignedGroupIds);

    private sealed record AccessPermissionsResponse(
        bool CanManageUsers,
        bool CanManageClients,
        bool CanManageGroups,
        bool CanMarkAttendance,
        bool CanViewAuditLog);
}
