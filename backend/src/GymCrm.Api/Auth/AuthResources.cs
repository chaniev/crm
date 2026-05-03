using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class AuthResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.AuthResources",
        typeof(AuthResources).Assembly);

    public static string LoginRequired => GetString(nameof(LoginRequired));

    public static string PasswordRequired => GetString(nameof(PasswordRequired));

    public static string InvalidCredentialsDetail => GetString(nameof(InvalidCredentialsDetail));

    public static string CurrentPasswordRequired => GetString(nameof(CurrentPasswordRequired));

    public static string NewPasswordRequired => GetString(nameof(NewPasswordRequired));

    public static string NewPasswordMustDiffer => GetString(nameof(NewPasswordMustDiffer));

    public static string CurrentPasswordInvalid => GetString(nameof(CurrentPasswordInvalid));

    public static string InvalidCsrfProblemDetail => GetString(nameof(InvalidCsrfProblemDetail));

    public static string PasswordChangeRequiredProblemDetail => GetString(nameof(PasswordChangeRequiredProblemDetail));

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
