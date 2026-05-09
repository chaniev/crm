using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class BranchResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.BranchResources",
        typeof(BranchResources).Assembly);

    public static string BranchNameRequired => GetString(nameof(BranchNameRequired));
    public static string BranchAddressTooLong => GetString(nameof(BranchAddressTooLong));
    public static string BranchDescriptionTooLong => GetString(nameof(BranchDescriptionTooLong));
    public static string BranchMustExist => GetString(nameof(BranchMustExist));
    public static string BranchMustBeActive => GetString(nameof(BranchMustBeActive));
    public static string HallBranchRequired => GetString(nameof(HallBranchRequired));
    public static string HallBranchImmutable => GetString(nameof(HallBranchImmutable));
    public static string HallNameRequired => GetString(nameof(HallNameRequired));
    public static string HallDescriptionTooLong => GetString(nameof(HallDescriptionTooLong));
    public static string HallMustExist => GetString(nameof(HallMustExist));
    public static string HallMustBeActive => GetString(nameof(HallMustBeActive));
    public static string HallCannotBeArchivedWithGroups => GetString(nameof(HallCannotBeArchivedWithGroups));
    public static string HallCannotBeDeletedWithGroups => GetString(nameof(HallCannotBeDeletedWithGroups));

    public static string BranchNameTooLong(int maxLength)
    {
        return Format(nameof(BranchNameTooLong), maxLength);
    }

    public static string HallNameTooLong(int maxLength)
    {
        return Format(nameof(HallNameTooLong), maxLength);
    }

    public static string BranchCreatedDescription(string actorLogin, string branchName)
    {
        return Format(nameof(BranchCreatedDescription), actorLogin, branchName);
    }

    public static string BranchUpdatedDescription(string actorLogin, string branchName)
    {
        return Format(nameof(BranchUpdatedDescription), actorLogin, branchName);
    }

    public static string BranchArchivedDescription(string actorLogin, string branchName)
    {
        return Format(nameof(BranchArchivedDescription), actorLogin, branchName);
    }

    public static string BranchRestoredDescription(string actorLogin, string branchName)
    {
        return Format(nameof(BranchRestoredDescription), actorLogin, branchName);
    }

    public static string HallCreatedDescription(string actorLogin, string hallName)
    {
        return Format(nameof(HallCreatedDescription), actorLogin, hallName);
    }

    public static string HallUpdatedDescription(string actorLogin, string hallName)
    {
        return Format(nameof(HallUpdatedDescription), actorLogin, hallName);
    }

    public static string HallArchivedDescription(string actorLogin, string hallName)
    {
        return Format(nameof(HallArchivedDescription), actorLogin, hallName);
    }

    public static string HallRestoredDescription(string actorLogin, string hallName)
    {
        return Format(nameof(HallRestoredDescription), actorLogin, hallName);
    }

    public static string HallDeletedDescription(string actorLogin, string hallName)
    {
        return Format(nameof(HallDeletedDescription), actorLogin, hallName);
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
