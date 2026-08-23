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
        var group = endpoints.MapGroup("/coaches")
            .RequireAuthorization();

        group.MapGet("/", ListUsersAsync);
        group.MapGet("/{id:guid}", GetUserAsync);
        group.MapPost("/", CreateUserAsync);
        group.MapPut("/{id:guid}", UpdateUserAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<UserListResponse>, ProblemHttpResult, UnauthorizedHttpResult>> ListUsersAsync(
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var readDecision = StaffManagementBoundary.AuthorizeRead(currentUser, UserRole.Coach);
        if (!readDecision.Allowed)
        {
            return StaffProblemDetails.FromDenial(readDecision.Denial);
        }

        IReadOnlyList<UserResponse> users = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Coach)
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => ToResponse(user, currentUser))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(new UserListResponse(
            users,
            StaffManagementBoundary.GetCreateRoleOptions(currentUser, StaffEndpointRoleFamily.Trainers)));
    }

    private static async Task<Results<Ok<UserResponse>, ProblemHttpResult, UnauthorizedHttpResult>> GetUserAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var readDecision = StaffManagementBoundary.AuthorizeRead(currentUser, UserRole.Coach);
        if (!readDecision.Allowed)
        {
            return StaffProblemDetails.FromDenial(readDecision.Denial);
        }

        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Id == id && candidate.Role == UserRole.Coach,
                cancellationToken);

        return user is null
            ? StaffProblemDetails.NotFound()
            : TypedResults.Ok(ToResponse(user, currentUser));
    }

    private static async Task<Results<Created<UserResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateUserAsync(
        CreateUserRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IPasswordHashService passwordHashService,
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

        var mutationResult = await StaffManagementMutationService.CreateAsync(
            new StaffCreateCommand(
                currentUser,
                request.FullName,
                request.Login,
                request.Password,
                request.Role,
                request.MustChangePassword,
                request.IsActive,
                request.MessengerPlatform,
                request.MessengerPlatformUserId,
                request.BranchId,
                StaffEndpointRoleFamily.Trainers),
            dbContext,
            passwordHashService,
            cancellationToken);

        if (mutationResult.Status == StaffMutationStatus.ValidationFailed)
        {
            return TypedResults.ValidationProblem(mutationResult.ValidationErrors!);
        }

        if (mutationResult.Status == StaffMutationStatus.Forbidden)
        {
            return StaffProblemDetails.FromDenial(mutationResult.Denial);
        }

        if (mutationResult.Status != StaffMutationStatus.Created)
        {
            throw new InvalidOperationException($"Unsupported staff create result '{mutationResult.Status}'.");
        }

        var user = mutationResult.User!;
        return TypedResults.Created($"/coaches/{user.Id}", ToResponse(user, currentUser));
    }

    private static async Task<Results<Ok<UserResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
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

        var mutationResult = await StaffManagementMutationService.UpdateAsync(
            new StaffUpdateCommand(
                currentUser,
                id,
                StaffEndpointRoleFamily.Trainers,
                AllowHeadCoachSelfUpdateException: true,
                request.FullName,
                request.Login,
                request.Role,
                request.MustChangePassword,
                request.IsActive,
                request.MessengerPlatform,
                request.MessengerPlatformUserId,
                request.BranchId),
            dbContext,
            cancellationToken);

        if (mutationResult.Status == StaffMutationStatus.NotFound)
        {
            return StaffProblemDetails.NotFound();
        }

        if (mutationResult.Status == StaffMutationStatus.ValidationFailed)
        {
            return TypedResults.ValidationProblem(mutationResult.ValidationErrors!);
        }

        if (mutationResult.Status == StaffMutationStatus.Forbidden)
        {
            return StaffProblemDetails.FromDenial(mutationResult.Denial);
        }

        if (mutationResult.Status != StaffMutationStatus.Updated)
        {
            throw new InvalidOperationException($"Unsupported staff update result '{mutationResult.Status}'.");
        }

        var user = mutationResult.User!;
        if (currentUser.Id == user.Id)
        {
            await AuthSessionSync.SyncCurrentSessionAsync(httpContext, user);
        }

        return TypedResults.Ok(ToResponse(user, currentUser));
    }

    private static UserResponse ToResponse(User user, User currentUser)
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
            user.UpdatedAt,
            user.BranchId,
            user.Branch?.Name,
            StaffManagementBoundary.GetAllowedActions(currentUser, user),
            StaffManagementBoundary.GetUpdateRoleOptions(
                currentUser,
                user,
                StaffEndpointRoleFamily.Trainers,
                allowHeadCoachSelfUpdateException: true));
    }
}
