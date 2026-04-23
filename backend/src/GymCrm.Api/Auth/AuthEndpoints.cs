using System.Text.Json;
using GymCrm.Application.Authorization;
using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GymCrm.Api.Auth;

internal static class AuthEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(AuthConstants.AuthRoutePrefix);

        group.MapGet(AuthConstants.SessionRoute, GetSessionAsync);
        group.MapGet(AuthConstants.ProfileRoute, GetProfileAsync).RequireAuthorization();
        group.MapPost(AuthConstants.LoginRoute, LoginAsync);
        group.MapPost(AuthConstants.LogoutRoute, LogoutAsync).RequireAuthorization();
        group.MapPost(AuthConstants.ChangePasswordRoute, ChangePasswordAsync).RequireAuthorization();

        return endpoints;
    }

    private static async Task<Ok<SessionResponse>> GetSessionAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        GymCrmDbContext dbContext,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        CancellationToken cancellationToken)
    {
        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            dbContext,
            bootstrapUserOptions,
            cancellationToken: cancellationToken));
    }

    private static async Task<Results<Ok<AuthenticatedUserResponse>, UnauthorizedHttpResult>> GetProfileAsync(
        HttpContext httpContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var user = httpContext.GetAuthenticatedGymCrmUser();
        return user is null
            ? TypedResults.Unauthorized()
            : TypedResults.Ok(await ToUserResponseAsync(user, accessScopeService, cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ValidationProblem, ProblemHttpResult>> LoginAsync(
        LoginRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
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
                AuthAuditConstants.LoginAction,
                AuthAuditConstants.UserSessionEntityType,
                user.Id.ToString(),
                AuthAuditResources.LoginDescription(user.Login)),
            cancellationToken);

        await AuthSessionSync.SignInAsync(httpContext, user);

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            dbContext,
            bootstrapUserOptions,
            user,
            cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult, UnauthorizedHttpResult>> LogoutAsync(
        HttpContext httpContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        GymCrmDbContext dbContext,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var user = httpContext.GetAuthenticatedGymCrmUser();
        if (user is null)
        {
            return TypedResults.Unauthorized();
        }

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                user.Id,
                AuthAuditConstants.LogoutAction,
                AuthAuditConstants.UserSessionEntityType,
                user.Id.ToString(),
                AuthAuditResources.LogoutDescription(user.Login)),
            cancellationToken);

        await AuthSessionSync.SignOutAsync(httpContext);

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            dbContext,
            bootstrapUserOptions,
            cancellationToken: cancellationToken));
    }

    private static async Task<Results<Ok<SessionResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ChangePasswordAsync(
        ChangePasswordRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
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
                AuthAuditConstants.PasswordChangedAction,
                AuthAuditConstants.UserEntityType,
                user.Id.ToString(),
                AuthAuditResources.PasswordChangedDescription(user.Login),
                oldState,
                newState),
            cancellationToken);

        await AuthSessionSync.SignInAsync(httpContext, user, now);

        return TypedResults.Ok(await CreateSessionResponseAsync(
            httpContext,
            antiforgery,
            accessScopeService,
            dbContext,
            bootstrapUserOptions,
            user,
            cancellationToken));
    }

    private static async Task<SessionResponse> CreateSessionResponseAsync(
        HttpContext httpContext,
        IAntiforgery antiforgery,
        IAccessScopeService accessScopeService,
        GymCrmDbContext dbContext,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        User? authenticatedUser = null,
        CancellationToken cancellationToken = default)
    {
        var user = authenticatedUser ?? httpContext.GetAuthenticatedGymCrmUser();
        var tokens = antiforgery.GetAndStoreTokens(httpContext);
        var bootstrapMode = await ResolveBootstrapModeAsync(
            dbContext,
            bootstrapUserOptions,
            cancellationToken);

        return new SessionResponse(
            user is not null,
            tokens.RequestToken ?? string.Empty,
            user is null
                ? null
                : await ToUserResponseAsync(user, accessScopeService, cancellationToken),
            bootstrapMode);
    }

    private static async Task<bool> ResolveBootstrapModeAsync(
        GymCrmDbContext dbContext,
        IOptions<BootstrapUserOptions> bootstrapUserOptions,
        CancellationToken cancellationToken)
    {
        var configuredLogin = bootstrapUserOptions.Value.Login;
        var login = string.IsNullOrWhiteSpace(configuredLogin)
            ? "headcoach"
            : configuredLogin.Trim();

        var userCount = await dbContext.Users.CountAsync(cancellationToken);
        if (userCount != 1)
        {
            return false;
        }

        return await dbContext.Users.AnyAsync(
            user =>
                user.Login == login &&
                user.Role == UserRole.HeadCoach &&
                user.MustChangePassword &&
                user.IsActive,
            cancellationToken);
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

    private sealed record LoginRequest(string Login, string Password);

    private sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    private sealed record SessionResponse(
        bool IsAuthenticated,
        string CsrfToken,
        AuthenticatedUserResponse? User,
        bool BootstrapMode);

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
