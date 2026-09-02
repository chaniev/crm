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
        var administratorNumbers = Enumerable.Range(1, LeninskySeedData.AdministratorCount).ToArray();
        var normalizedKeys = administratorNumbers
            .SelectMany(number => new[] { CreateLogin(number), CreateLegacyLogin(number) })
            .Select(LoginIdentity.NormalizeKey)
            .ToArray();
        var existingUsers = await dbContext.Users
            .Where(user => normalizedKeys.Contains(user.LoginNormalized))
            .ToArrayAsync(cancellationToken);

        foreach (var number in administratorNumbers)
        {
            var login = CreateLogin(number);
            var currentUser = existingUsers.SingleOrDefault(
                user => user.LoginNormalized == LoginIdentity.NormalizeKey(login));
            var legacyUser = existingUsers.SingleOrDefault(
                user => user.LoginNormalized == LoginIdentity.NormalizeKey(CreateLegacyLogin(number)));

            if (currentUser is not null && legacyUser is not null)
            {
                throw new InvalidOperationException(
                    $"Cannot rename seed administrator '{legacyUser.Login}' because login '{login}' already exists.");
            }

            var user = currentUser ?? legacyUser;
            if (user is null)
            {
                user = new User
                {
                    Id = LeninskySeedIds.Administrator(number),
                    CreatedAt = now
                };
                dbContext.Users.Add(user);
            }

            user.Login = login;
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

    public static string CreateLogin(int number) => $"admin{number}";

    private static string CreateLegacyLogin(int number) => $"leninsky.admin{number}";
}
