namespace GymCrm.Domain.Users;

/// <summary>
/// Single backend authority for login identity comparison. The normalized key is
/// deterministic and culture-independent; the canonical <see cref="User.Login"/>
/// value is never rewritten by normalization.
/// </summary>
public static class LoginIdentity
{
    public static string NormalizeKey(string login)
    {
        ArgumentNullException.ThrowIfNull(login);

        return login.Trim().ToLowerInvariant();
    }
}
