using System.Security.Claims;
using System.Text.Json;
using Crm.Application.Audit;
using Crm.Application.Security;
using Crm.Domain.Users;
using Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Crm.Api.Auth;

internal static class UserEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/users")
            .RequireAuthorization(CrmAuthorizationPolicies.ManageUsers);

        group.MapGet("/", ListUsersAsync);
        group.MapGet("/{id:guid}", GetUserAsync);
        group.MapPost("/", CreateUserAsync);
        group.MapPut("/{id:guid}", UpdateUserAsync);

        return endpoints;
    }

    private static async Task<Ok<IReadOnlyList<UserResponse>>> ListUsersAsync(
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<UserResponse> users = await dbContext.Users
            .AsNoTracking()
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new UserResponse(
                user.Id,
                user.FullName,
                user.Login,
                user.Role.ToString(),
                user.MustChangePassword,
                user.IsActive,
                user.CreatedAt,
                user.UpdatedAt))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(users);
    }

    private static async Task<Results<Ok<UserResponse>, NotFound>> GetUserAsync(
        Guid id,
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return user is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(user));
    }

    private static async Task<Results<Created<UserResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateUserAsync(
        CreateUserRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
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

        var fullName = request.FullName?.Trim() ?? string.Empty;
        var login = request.Login?.Trim() ?? string.Empty;

        var errors = await ValidateCreateRequestAsync(
            fullName,
            login,
            request.Password,
            request.Role,
            dbContext,
            cancellationToken);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var role = ParseRole(request.Role)!;
        var now = DateTimeOffset.UtcNow;

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = role.Value,
            MustChangePassword = request.MustChangePassword,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, request.Password);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "UserCreated",
                "User",
                user.Id.ToString(),
                $"User '{currentUser.Login}' created user '{user.Login}'.",
                NewValueJson: SerializeAuditState(user)),
            cancellationToken);

        return TypedResults.Created($"/users/{user.Id}", ToResponse(user));
    }

    private static async Task<Results<Ok<UserResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        HttpContext httpContext,
        CrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
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

        var user = await dbContext.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (user is null)
        {
            return TypedResults.NotFound();
        }

        var fullName = request.FullName?.Trim() ?? string.Empty;
        var requestedLogin = request.Login?.Trim() ?? string.Empty;

        var errors = ValidateUpdateRequest(fullName, requestedLogin, request.Role, request.IsActive, user);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var role = ParseRole(request.Role)!.Value;
        var oldState = SerializeAuditState(user);
        var isSelfUpdate = currentUser.Id == user.Id;

        user.FullName = fullName;
        user.Role = role;
        user.MustChangePassword = request.MustChangePassword;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                "UserUpdated",
                "User",
                user.Id.ToString(),
                $"User '{currentUser.Login}' updated user '{user.Login}'.",
                oldState,
                SerializeAuditState(user)),
            cancellationToken);

        if (isSelfUpdate)
        {
            await SyncCurrentSessionAsync(httpContext, user);
        }

        return TypedResults.Ok(ToResponse(user));
    }

    private static async Task<Dictionary<string, string[]>> ValidateCreateRequestAsync(
        string fullName,
        string login,
        string password,
        string role,
        CrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors["fullName"] = ["Укажите ФИО."];
        }

        if (string.IsNullOrWhiteSpace(login))
        {
            errors["login"] = ["Укажите логин."];
        }
        else if (await dbContext.Users.AnyAsync(candidate => candidate.Login == login, cancellationToken))
        {
            errors["login"] = ["Пользователь с таким логином уже существует."];
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            errors["password"] = ["Укажите пароль."];
        }

        var parsedRole = ParseRole(role);
        if (parsedRole is null)
        {
            errors["role"] = ["Укажите корректную роль пользователя."];
        }
        else if (parsedRole is UserRole.HeadCoach)
        {
            errors["role"] = ["Создание пользователя с ролью HeadCoach не поддерживается в MVP."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateUpdateRequest(
        string fullName,
        string requestedLogin,
        string role,
        bool isActive,
        User user)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors["fullName"] = ["Укажите ФИО."];
        }

        if (string.IsNullOrWhiteSpace(requestedLogin))
        {
            errors["login"] = ["Логин обязателен."];
        }
        else if (!string.Equals(requestedLogin, user.Login, StringComparison.Ordinal))
        {
            errors["login"] = ["Логин нельзя изменить после создания пользователя."];
        }

        var parsedRole = ParseRole(role);
        if (parsedRole is null)
        {
            errors["role"] = ["Укажите корректную роль пользователя."];
            return errors;
        }

        if (user.Role == UserRole.HeadCoach)
        {
            if (parsedRole != UserRole.HeadCoach)
            {
                errors["role"] = ["Роль пользователя HeadCoach нельзя изменить в MVP."];
            }

            if (!isActive)
            {
                errors["isActive"] = ["Пользователя с ролью HeadCoach нельзя деактивировать в MVP."];
            }
        }
        else if (parsedRole == UserRole.HeadCoach)
        {
            errors["role"] = ["Назначение роли HeadCoach не поддерживается в MVP."];
        }

        return errors;
    }

    private static UserRole? ParseRole(string? role)
    {
        return Enum.TryParse<UserRole>(role?.Trim(), ignoreCase: true, out var parsedRole)
            ? parsedRole
            : null;
    }

    private static async Task SyncCurrentSessionAsync(HttpContext httpContext, User user)
    {
        if (!user.IsActive)
        {
            await httpContext.SignOutAsync(AuthConstants.CookieScheme);
            httpContext.Items.Remove(AuthConstants.AuthenticatedUserItemKey);
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
            return;
        }

        var principal = CreatePrincipal(user);
        await httpContext.SignInAsync(
            AuthConstants.CookieScheme,
            principal,
            CreateAuthenticationProperties(user.UpdatedAt));

        httpContext.Items[AuthConstants.AuthenticatedUserItemKey] = user;
        httpContext.User = principal;
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

    private static AuthenticationProperties CreateAuthenticationProperties(DateTimeOffset issuedAt)
    {
        return new AuthenticationProperties
        {
            AllowRefresh = true,
            ExpiresUtc = issuedAt.AddHours(8),
            IsPersistent = true,
            IssuedUtc = issuedAt
        };
    }

    private static string SerializeAuditState(User user)
    {
        return JsonSerializer.Serialize(
            new UserAuditState(
                user.Id,
                user.FullName,
                user.Login,
                user.Role.ToString(),
                user.MustChangePassword,
                user.IsActive,
                user.CreatedAt,
                user.UpdatedAt),
            AuditSerializerOptions);
    }

    private static UserResponse ToResponse(User user)
    {
        return new UserResponse(
            user.Id,
            user.FullName,
            user.Login,
            user.Role.ToString(),
            user.MustChangePassword,
            user.IsActive,
            user.CreatedAt,
            user.UpdatedAt);
    }

    private sealed record CreateUserRequest(
        string FullName,
        string Login,
        string Password,
        string Role,
        bool MustChangePassword,
        bool IsActive);

    private sealed record UpdateUserRequest(
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive);

    private sealed record UserResponse(
        Guid Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);

    private sealed record UserAuditState(
        Guid Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangeCredentials,
        bool IsActive,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);
}
