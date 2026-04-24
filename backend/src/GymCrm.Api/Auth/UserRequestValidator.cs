using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class UserRequestValidator
{
    public static async Task<Dictionary<string, string[]>> ValidateCreateAsync(
        string fullName,
        string login,
        string password,
        string role,
        string? messengerPlatform,
        string? messengerPlatformUserId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors["fullName"] = [UserResources.FullNameRequired];
        }

        if (string.IsNullOrWhiteSpace(login))
        {
            errors["login"] = [UserResources.LoginRequired];
        }
        else if (await dbContext.Users.AnyAsync(candidate => candidate.Login == login, cancellationToken))
        {
            errors["login"] = [UserResources.LoginAlreadyExists];
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            errors["password"] = [UserResources.PasswordRequired];
        }

        var parsedRole = ParseRole(role);
        if (parsedRole is null)
        {
            errors["role"] = [UserResources.InvalidRole];
        }
        else if (parsedRole is UserRole.HeadCoach)
        {
            errors["role"] = [UserResources.HeadCoachCreationUnavailable];
        }

        await ValidateMessengerIdentityAsync(
            messengerPlatform,
            messengerPlatformUserId,
            userIdToExclude: null,
            errors,
            dbContext,
            cancellationToken);

        return errors;
    }

    public static async Task<Dictionary<string, string[]>> ValidateUpdateAsync(
        string fullName,
        string requestedLogin,
        string role,
        string? messengerPlatform,
        string? messengerPlatformUserId,
        bool isActive,
        User user,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors["fullName"] = [UserResources.FullNameRequired];
        }

        if (string.IsNullOrWhiteSpace(requestedLogin))
        {
            errors["login"] = [UserResources.LoginRequiredOnUpdate];
        }
        else if (!string.Equals(requestedLogin, user.Login, StringComparison.Ordinal))
        {
            errors["login"] = [UserResources.LoginIsImmutable];
        }

        var parsedRole = ParseRole(role);
        if (parsedRole is null)
        {
            errors["role"] = [UserResources.InvalidRole];
            return errors;
        }

        if (user.Role == UserRole.HeadCoach)
        {
            if (parsedRole != UserRole.HeadCoach)
            {
                errors["role"] = [UserResources.HeadCoachRoleImmutable];
            }

            if (!isActive)
            {
                errors["isActive"] = [UserResources.HeadCoachCannotBeDeactivated];
            }
        }
        else if (parsedRole == UserRole.HeadCoach)
        {
            errors["role"] = [UserResources.HeadCoachAssignmentUnavailable];
        }

        await ValidateMessengerIdentityAsync(
            messengerPlatform,
            messengerPlatformUserId,
            user.Id,
            errors,
            dbContext,
            cancellationToken);

        return errors;
    }

    public static UserRole? ParseRole(string? role)
    {
        return Enum.TryParse<UserRole>(role?.Trim(), ignoreCase: true, out var parsedRole)
            ? parsedRole
            : null;
    }

    public static (MessengerPlatform? Platform, string? PlatformUserId) NormalizeMessengerIdentity(
        string? messengerPlatform,
        string? messengerPlatformUserId)
    {
        var normalizedPlatform = string.IsNullOrWhiteSpace(messengerPlatform)
            ? null
            : messengerPlatform.Trim();
        var normalizedPlatformUserId = string.IsNullOrWhiteSpace(messengerPlatformUserId)
            ? null
            : messengerPlatformUserId.Trim();

        if (normalizedPlatform is null && normalizedPlatformUserId is null)
        {
            return (null, null);
        }

        if (!Enum.TryParse<MessengerPlatform>(normalizedPlatform, ignoreCase: true, out var parsedPlatform))
        {
            return (null, normalizedPlatformUserId);
        }

        return (parsedPlatform, normalizedPlatformUserId);
    }

    private static async Task ValidateMessengerIdentityAsync(
        string? messengerPlatform,
        string? messengerPlatformUserId,
        Guid? userIdToExclude,
        Dictionary<string, string[]> errors,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var normalizedPlatform = string.IsNullOrWhiteSpace(messengerPlatform)
            ? null
            : messengerPlatform.Trim();
        var normalizedPlatformUserId = string.IsNullOrWhiteSpace(messengerPlatformUserId)
            ? null
            : messengerPlatformUserId.Trim();

        if (normalizedPlatform is null && normalizedPlatformUserId is null)
        {
            return;
        }

        if (normalizedPlatform is null)
        {
            errors["messengerPlatform"] = [UserResources.MessengerPlatformRequired];
            return;
        }

        if (!Enum.TryParse<MessengerPlatform>(normalizedPlatform, ignoreCase: true, out var parsedPlatform))
        {
            errors["messengerPlatform"] = [UserResources.InvalidMessengerPlatform];
            return;
        }

        if (normalizedPlatformUserId is null)
        {
            errors["messengerPlatformUserId"] = [UserResources.MessengerPlatformUserIdRequired];
            return;
        }

        if (normalizedPlatformUserId.Length > 128)
        {
            errors["messengerPlatformUserId"] = [UserResources.MessengerPlatformUserIdTooLong];
            return;
        }

        var duplicateExists = await dbContext.Users.AnyAsync(
            candidate =>
                candidate.MessengerPlatform == parsedPlatform &&
                candidate.MessengerPlatformUserId == normalizedPlatformUserId &&
                (!userIdToExclude.HasValue || candidate.Id != userIdToExclude.Value),
            cancellationToken);

        if (duplicateExists)
        {
            errors["messengerPlatformUserId"] = [UserResources.MessengerPlatformUserIdAlreadyExists];
        }
    }
}
