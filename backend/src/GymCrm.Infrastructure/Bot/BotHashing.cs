using System.Security.Cryptography;
using System.Text;

namespace GymCrm.Infrastructure.Bot;

internal static class BotHashing
{
    public static string ComputeSha256(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash);
    }
}
