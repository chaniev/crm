using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal static class LeninskyPrivilegedUserSeed
{
    private const bool MustChangePassword = false;

    public static async Task UpsertAsync(
        GymCrmDbContext dbContext,
        PasswordHasher<User> passwordHasher,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            new UserDefinition(
                LeninskySeedIds.HeadCoach,
                LeninskySeedData.HeadCoachLogin,
                LeninskySeedData.HeadCoachFullName,
                UserRole.HeadCoach),
            new UserDefinition(
                LeninskySeedIds.SuperAdministrator,
                LeninskySeedData.SuperAdministratorLogin,
                LeninskySeedData.SuperAdministratorFullName,
                UserRole.SuperAdministrator)
        };
        var logins = definitions.Select(definition => definition.Login).ToArray();
        var existingUsers = await dbContext.Users
            .Where(user => logins.Contains(user.Login))
            .ToDictionaryAsync(user => user.Login, StringComparer.Ordinal, cancellationToken);

        foreach (var definition in definitions)
        {
            if (!existingUsers.TryGetValue(definition.Login, out var user))
            {
                user = new User
                {
                    Id = definition.Id,
                    Login = definition.Login,
                    CreatedAt = now
                };
                dbContext.Users.Add(user);
            }

            user.FullName = definition.FullName;
            user.Role = definition.Role;
            user.BranchId = null;
            user.MustChangePassword = MustChangePassword;
            user.IsActive = true;
            user.UpdatedAt = now;
            user.PasswordHash = passwordHasher.HashPassword(user, LeninskySeedData.DefaultPassword);
        }
    }

    private sealed record UserDefinition(
        Guid Id,
        string Login,
        string FullName,
        UserRole Role);
}
