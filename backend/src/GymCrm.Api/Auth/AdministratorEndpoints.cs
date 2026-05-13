using GymCrm.Application.Audit;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class AdministratorEndpoints
{
    public static IEndpointRouteBuilder MapAdministratorEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/settings/administrators")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageSettings);

        group.MapGet("/", ListAdministratorsAsync);
        group.MapGet("/{id:guid}", GetAdministratorAsync);
        group.MapPost("/", CreateAdministratorAsync);
        group.MapPut("/{id:guid}", UpdateAdministratorAsync);

        return endpoints;
    }

    private static async Task<Ok<IReadOnlyList<UserResponse>>> ListAdministratorsAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<UserResponse> administrators = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Administrator)
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new UserResponse(
                user.Id,
                user.FullName,
                user.Login,
                user.Role.ToString(),
                user.MessengerPlatform != null ? user.MessengerPlatform.ToString() : null,
                user.MessengerPlatformUserId,
                user.MustChangePassword,
                user.IsActive,
                user.CreatedAt,
                user.UpdatedAt))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(administrators);
    }

    private static async Task<Results<Ok<UserResponse>, NotFound>> GetAdministratorAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Id == id && candidate.Role == UserRole.Administrator,
                cancellationToken);

        return user is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(user));
    }

    private static async Task<Results<Created<UserResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateAdministratorAsync(
        CreateAdministratorRequest request,
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
        var role = UserRole.Administrator.ToString();

        var errors = await UserRequestValidator.ValidateCreateAsync(
            fullName,
            login,
            request.Password,
            role,
            request.MessengerPlatform,
            request.MessengerPlatformUserId,
            dbContext,
            cancellationToken,
            allowAdministratorRole: true);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var messengerIdentity = UserRequestValidator.NormalizeMessengerIdentity(
            request.MessengerPlatform,
            request.MessengerPlatformUserId);
        var now = DateTimeOffset.UtcNow;

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = UserRole.Administrator,
            MessengerPlatform = messengerIdentity.Platform,
            MessengerPlatformUserId = messengerIdentity.PlatformUserId,
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

        return TypedResults.Created($"/settings/administrators/{user.Id}", ToResponse(user));
    }

    private static async Task<Results<Ok<UserResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateAdministratorAsync(
        Guid id,
        UpdateAdministratorRequest request,
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
            .SingleOrDefaultAsync(
                candidate => candidate.Id == id && candidate.Role == UserRole.Administrator,
                cancellationToken);

        if (user is null)
        {
            return TypedResults.NotFound();
        }

        var fullName = request.FullName?.Trim() ?? string.Empty;
        var requestedLogin = request.Login?.Trim() ?? string.Empty;

        var errors = await UserRequestValidator.ValidateUpdateAsync(
            fullName,
            requestedLogin,
            UserRole.Administrator.ToString(),
            request.MessengerPlatform,
            request.MessengerPlatformUserId,
            request.IsActive,
            user,
            dbContext,
            cancellationToken,
            allowAdministratorRole: true);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var messengerIdentity = UserRequestValidator.NormalizeMessengerIdentity(
            request.MessengerPlatform,
            request.MessengerPlatformUserId);
        var oldState = UserAuditSerializer.Serialize(user);
        var isSelfUpdate = currentUser.Id == user.Id;

        user.FullName = fullName;
        user.MessengerPlatform = messengerIdentity.Platform;
        user.MessengerPlatformUserId = messengerIdentity.PlatformUserId;
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
            user.MessengerPlatform?.ToString(),
            user.MessengerPlatformUserId,
            user.MustChangePassword,
            user.IsActive,
            user.CreatedAt,
            user.UpdatedAt);
    }
}
