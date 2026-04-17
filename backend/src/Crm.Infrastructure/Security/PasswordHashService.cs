using Crm.Application.Security;
using Crm.Domain.Users;
using Microsoft.AspNetCore.Identity;

namespace Crm.Infrastructure.Security;

internal sealed class PasswordHashService : IPasswordHashService
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public string HashPassword(User user, string password)
    {
        ArgumentNullException.ThrowIfNull(user);

        return _passwordHasher.HashPassword(user, password);
    }

    public bool VerifyPassword(User user, string password)
    {
        ArgumentNullException.ThrowIfNull(user);

        return _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password) !=
            PasswordVerificationResult.Failed;
    }
}
