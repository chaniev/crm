using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/users")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageUsers);

        group.MapGet("/", ListUsersAsync);
        group.MapGet("/{id:guid}", GetUserAsync);
        group.MapPost("/", CreateUserAsync);
        group.MapPut("/{id:guid}", UpdateUserAsync);

        return endpoints;
    }

    private static async Task<Ok<IReadOnlyList<UserResponse>>> ListUsersAsync(
        GymCrmDbContext dbContext,
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
        GymCrmDbContext dbContext,
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
        GymCrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
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

        var fullName = request.FullName?.Trim() ?? string.Empty;
        var login = request.Login?.Trim() ?? string.Empty;

        var errors = await UserRequestValidator.ValidateCreateAsync(
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

        var role = UserRequestValidator.ParseRole(request.Role)!;
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
                UserAuditConstants.UserCreatedAction,
                UserAuditConstants.UserEntityType,
                user.Id.ToString(),
                UserResources.UserCreatedDescription(currentUser.Login, user.Login),
                NewValueJson: UserAuditSerializer.Serialize(user)),
            cancellationToken);

        return TypedResults.Created($"/users/{user.Id}", ToResponse(user));
    }

    private static async Task<Results<Ok<UserResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
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

        var user = await dbContext.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (user is null)
        {
            return TypedResults.NotFound();
        }

        var fullName = request.FullName?.Trim() ?? string.Empty;
        var requestedLogin = request.Login?.Trim() ?? string.Empty;

        var errors = UserRequestValidator.ValidateUpdate(fullName, requestedLogin, request.Role, request.IsActive, user);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var role = UserRequestValidator.ParseRole(request.Role)!.Value;
        var oldState = UserAuditSerializer.Serialize(user);
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
                UserAuditConstants.UserUpdatedAction,
                UserAuditConstants.UserEntityType,
                user.Id.ToString(),
                UserResources.UserUpdatedDescription(currentUser.Login, user.Login),
                oldState,
                UserAuditSerializer.Serialize(user)),
            cancellationToken);

        if (isSelfUpdate)
        {
            await AuthSessionSync.SyncCurrentSessionAsync(httpContext, user);
        }

        return TypedResults.Ok(ToResponse(user));
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
}
