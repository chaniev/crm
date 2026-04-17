using Crm.Domain.Users;

namespace Crm.Application.Security;

public interface IPasswordHashService
{
    string HashPassword(User user, string password);
    bool VerifyPassword(User user, string password);
}
