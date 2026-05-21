using System.Security.Cryptography;
using System.Text;

namespace GymCrm.Infrastructure.Messenger;

internal static class MessengerHashing
{
    public static string ComputeSha256(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash);
    }

    public static string CreateToken(int byteLength = 16)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
