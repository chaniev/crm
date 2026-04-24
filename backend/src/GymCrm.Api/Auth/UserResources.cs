using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class UserResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.UserResources",
        typeof(UserResources).Assembly);

    public static string FullNameRequired => GetString(nameof(FullNameRequired));

    public static string LoginRequired => GetString(nameof(LoginRequired));

    public static string LoginRequiredOnUpdate => GetString(nameof(LoginRequiredOnUpdate));

    public static string PasswordRequired => GetString(nameof(PasswordRequired));

    public static string LoginAlreadyExists => GetString(nameof(LoginAlreadyExists));

    public static string InvalidRole => GetString(nameof(InvalidRole));

    public static string HeadCoachCreationUnavailable => GetString(nameof(HeadCoachCreationUnavailable));

    public static string LoginIsImmutable => GetString(nameof(LoginIsImmutable));

    public static string HeadCoachRoleImmutable => GetString(nameof(HeadCoachRoleImmutable));

    public static string HeadCoachCannotBeDeactivated => GetString(nameof(HeadCoachCannotBeDeactivated));

    public static string HeadCoachAssignmentUnavailable => GetString(nameof(HeadCoachAssignmentUnavailable));

    public static string InvalidMessengerPlatform => GetString(nameof(InvalidMessengerPlatform));

    public static string MessengerPlatformRequired => GetString(nameof(MessengerPlatformRequired));

    public static string MessengerPlatformUserIdRequired => GetString(nameof(MessengerPlatformUserIdRequired));

    public static string MessengerPlatformUserIdTooLong => GetString(nameof(MessengerPlatformUserIdTooLong));

    public static string MessengerPlatformUserIdAlreadyExists => GetString(nameof(MessengerPlatformUserIdAlreadyExists));

    public static string UserCreatedDescription(string actorLogin, string targetLogin)
    {
        return Format(nameof(UserCreatedDescription), actorLogin, targetLogin);
    }

    public static string UserUpdatedDescription(string actorLogin, string targetLogin)
    {
        return Format(nameof(UserUpdatedDescription), actorLogin, targetLogin);
    }

    private static string Format(string name, params object[] args)
    {
        return string.Format(CultureInfo.CurrentCulture, GetString(name), args);
    }

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
