using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class GroupTypeResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.GroupTypeResources",
        typeof(GroupTypeResources).Assembly);

    public static string NameRequired => GetString(nameof(NameRequired));
    public static string DescriptionTooLong => GetString(nameof(DescriptionTooLong));
    public static string SystemIdentifierRequired => GetString(nameof(SystemIdentifierRequired));
    public static string NameAlreadyExists => GetString(nameof(NameAlreadyExists));
    public static string SystemIdentifierAlreadyExists => GetString(nameof(SystemIdentifierAlreadyExists));
    public static string GroupTypeCannotBeDeletedWithGroups => GetString(nameof(GroupTypeCannotBeDeletedWithGroups));

    public static string NameTooLong(int maxLength)
    {
        return Format(nameof(NameTooLong), maxLength);
    }

    public static string SystemIdentifierTooLong(int maxLength)
    {
        return Format(nameof(SystemIdentifierTooLong), maxLength);
    }

    public static string GroupTypeCreatedDescription(string actorLogin, string groupTypeName)
    {
        return Format(nameof(GroupTypeCreatedDescription), actorLogin, groupTypeName);
    }

    public static string GroupTypeUpdatedDescription(string actorLogin, string groupTypeName)
    {
        return Format(nameof(GroupTypeUpdatedDescription), actorLogin, groupTypeName);
    }

    public static string GroupTypeDeletedDescription(string actorLogin, string groupTypeName)
    {
        return Format(nameof(GroupTypeDeletedDescription), actorLogin, groupTypeName);
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
