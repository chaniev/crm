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

        return errors;
    }

    public static Dictionary<string, string[]> ValidateUpdate(
        string fullName,
        string requestedLogin,
        string role,
        bool isActive,
        User user)
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

        return errors;
    }

    public static UserRole? ParseRole(string? role)
    {
        return Enum.TryParse<UserRole>(role?.Trim(), ignoreCase: true, out var parsedRole)
            ? parsedRole
            : null;
    }
}
