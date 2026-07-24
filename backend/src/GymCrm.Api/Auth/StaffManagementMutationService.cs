using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class StaffManagementMutationService
{
    public static async Task<StaffMutationResult> CreateAsync(
        StaffCreateCommand command,
        GymCrmDbContext dbContext,
        IPasswordHashService passwordHashService,
        CancellationToken cancellationToken)
    {
        var managementDecision = StaffManagementBoundary.AuthorizeManagement(command.Actor);
        if (!managementDecision.Allowed)
        {
            return StaffMutationResult.Forbidden(managementDecision.Denial);
        }

        var fullName = command.FullName?.Trim() ?? string.Empty;
        var login = command.Login?.Trim() ?? string.Empty;
        var requestedRole = UserRequestValidator.ParseRole(command.Role);
        if (requestedRole.HasValue)
        {
            var authorizationDecision = StaffManagementBoundary.AuthorizeCreate(command.Actor, requestedRole.Value);
            if (!authorizationDecision.Allowed)
            {
                return StaffMutationResult.Forbidden(authorizationDecision.Denial);
            }
        }

        var errors = await UserRequestValidator.ValidateCreateAsync(
            fullName,
            login,
            command.Password ?? string.Empty,
            command.Role ?? string.Empty,
            command.MessengerPlatform,
            command.MessengerPlatformUserId,
            dbContext,
            cancellationToken);
        if (errors.Count > 0)
        {
            return StaffMutationResult.ValidationFailed(errors);
        }

        var destinationRole = requestedRole ?? throw new InvalidOperationException("Validated role was not parsed.");
        var branchErrors = await ValidateDestinationBranchAsync(
            destinationRole,
            command.BranchId,
            currentBranchId: null,
            dbContext,
            cancellationToken);
        if (branchErrors.Count > 0)
        {
            return StaffMutationResult.ValidationFailed(branchErrors);
        }

        var messengerIdentity = UserRequestValidator.NormalizeMessengerIdentity(
            command.MessengerPlatform,
            command.MessengerPlatformUserId);
        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = destinationRole,
            MessengerPlatform = messengerIdentity.Platform,
            MessengerPlatformUserId = messengerIdentity.PlatformUserId,
            MustChangePassword = command.MustChangePassword,
            IsActive = command.IsActive,
            BranchId = destinationRole == UserRole.Administrator ? command.BranchId : null,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, command.Password ?? string.Empty);

        dbContext.Users.Add(user);
        dbContext.AuditLogs.Add(StaffManagementBoundary.CreateAuditLog(
            command.Actor.Id,
            UserAuditConstants.UserCreatedAction,
            user.Id.ToString(),
            UserResources.UserCreatedDescription(command.Actor.Login, user.Login),
            oldState: null,
            newState: UserAuditSerializer.Serialize(user)));

        await dbContext.SaveChangesAsync(cancellationToken);
        return StaffMutationResult.Created(user);
    }

    public static async Task<StaffMutationResult> UpdateAsync(
        StaffUpdateCommand command,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var managementDecision = StaffManagementBoundary.AuthorizeManagement(command.Actor);
        if (!managementDecision.Allowed)
        {
            return StaffMutationResult.Forbidden(managementDecision.Denial);
        }

        var users = dbContext.Users.AsQueryable();
        if (command.TargetRoleFilter.HasValue)
        {
            users = users.Where(user => user.Role == command.TargetRoleFilter.Value);
        }

        var user = await users.SingleOrDefaultAsync(
            candidate => candidate.Id == command.TargetId,
            cancellationToken);
        if (user is null)
        {
            return StaffMutationResult.NotFound();
        }

        var fullName = command.FullName?.Trim() ?? string.Empty;
        var requestedLogin = command.Login?.Trim() ?? string.Empty;
        var requestedRole = UserRequestValidator.ParseRole(command.Role);
        if (requestedRole.HasValue)
        {
            var authorizationDecision = StaffManagementBoundary.AuthorizeUpdate(command.Actor, user, requestedRole.Value);
            if (!authorizationDecision.Allowed)
            {
                return StaffMutationResult.Forbidden(authorizationDecision.Denial);
            }
        }

        var errors = await UserRequestValidator.ValidateUpdateAsync(
            fullName,
            requestedLogin,
            command.Role ?? string.Empty,
            command.MessengerPlatform,
            command.MessengerPlatformUserId,
            command.IsActive,
            user,
            dbContext,
            cancellationToken);
        if (errors.Count > 0)
        {
            return StaffMutationResult.ValidationFailed(errors);
        }

        var destinationRole = requestedRole ?? throw new InvalidOperationException("Validated role was not parsed.");
        var branchErrors = await ValidateDestinationBranchAsync(
            destinationRole,
            command.BranchId,
            user.BranchId,
            dbContext,
            cancellationToken);
        if (branchErrors.Count > 0)
        {
            return StaffMutationResult.ValidationFailed(branchErrors);
        }

        var messengerIdentity = UserRequestValidator.NormalizeMessengerIdentity(
            command.MessengerPlatform,
            command.MessengerPlatformUserId);
        var oldState = UserAuditSerializer.Serialize(user);

        user.FullName = fullName;
        user.Role = destinationRole;
        user.BranchId = destinationRole == UserRole.Administrator ? command.BranchId : null;
        user.MessengerPlatform = messengerIdentity.Platform;
        user.MessengerPlatformUserId = messengerIdentity.PlatformUserId;
        user.MustChangePassword = command.MustChangePassword;
        user.IsActive = command.IsActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        dbContext.AuditLogs.Add(StaffManagementBoundary.CreateAuditLog(
            command.Actor.Id,
            UserAuditConstants.UserUpdatedAction,
            user.Id.ToString(),
            UserResources.UserUpdatedDescription(command.Actor.Login, user.Login),
            oldState,
            UserAuditSerializer.Serialize(user)));

        await dbContext.SaveChangesAsync(cancellationToken);
        return StaffMutationResult.Updated(user);
    }

    private static async Task<Dictionary<string, string[]>> ValidateDestinationBranchAsync(
        UserRole destinationRole,
        Guid? requestedBranchId,
        Guid? currentBranchId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (destinationRole != UserRole.Administrator)
        {
            return requestedBranchId.HasValue
                ? new Dictionary<string, string[]> { ["branchId"] = ["Branch must be empty for this role."] }
                : [];
        }

        if (!requestedBranchId.HasValue || requestedBranchId.Value == Guid.Empty)
        {
            return new Dictionary<string, string[]> { ["branchId"] = ["Active branch is required."] };
        }

        if (currentBranchId == requestedBranchId.Value)
        {
            return [];
        }

        var activeBranchExists = await dbContext.Branches.AnyAsync(
            branch => branch.Id == requestedBranchId.Value && !branch.IsArchived,
            cancellationToken);

        return activeBranchExists
            ? []
            : new Dictionary<string, string[]> { ["branchId"] = ["Active branch is required."] };
    }
}
