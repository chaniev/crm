using System.Security.Cryptography;
using System.Text;

namespace GymCrm.Api.SeedData;

internal static class LeninskySeedIds
{
    private const string Namespace = "gym-crm-leninsky-test-data:v1";

    public static Guid Branch => Create("branch");

    public static Guid Administrator(int number) => Create($"administrator:{number:00}");

    public static Guid Membership(int number) => Create($"membership:{number:00}");

    private static Guid Create(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{Namespace}:{key}"));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
