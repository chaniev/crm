using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal static class LeninskyAdministratorSeed
{
    private const bool MustChangePassword = false;

    public static async Task<int> UpsertAsync(
        GymCrmDbContext dbContext,
        PasswordHasher<User> passwordHasher,
        Guid branchId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var logins = Enumerable.Range(1, LeninskySeedData.AdministratorCount)
            .Select(CreateLogin)
            .ToArray();
        var existingUsers = await dbContext.Users
            .Where(user => logins.Contains(user.Login))
            .ToDictionaryAsync(user => user.Login, StringComparer.Ordinal, cancellationToken);

        for (var number = 1; number <= LeninskySeedData.AdministratorCount; number++)
        {
            var login = CreateLogin(number);
            if (!existingUsers.TryGetValue(login, out var user))
            {
                user = new User
                {
                    Id = LeninskySeedIds.Administrator(number),
                    Login = login,
                    CreatedAt = now
                };
                dbContext.Users.Add(user);
            }

            user.FullName = $"Администратор Ленинский {number}";
            user.Role = UserRole.Administrator;
            user.BranchId = branchId;
            user.MustChangePassword = MustChangePassword;
            user.IsActive = true;
            user.UpdatedAt = now;
            user.PasswordHash = passwordHasher.HashPassword(user, LeninskySeedData.DefaultPassword);
        }

        return LeninskySeedData.AdministratorCount;
    }

    public static string CreateLogin(int number) => $"leninsky.admin{number}";
}
