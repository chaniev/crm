using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class GroupResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.GroupResources",
        typeof(GroupResources).Assembly);

    public static string PageMustBeGreaterThanZero => GetString(nameof(PageMustBeGreaterThanZero));

    public static string PageSizeMustBeInRange(int maxTake)
    {
        return Format(nameof(PageSizeMustBeInRange), maxTake);
    }

    public static string SkipCannotBeNegative => GetString(nameof(SkipCannotBeNegative));

    public static string TakeMustBeInRange(int maxTake)
    {
        return Format(nameof(TakeMustBeInRange), maxTake);
    }

    public static string NameRequired => GetString(nameof(NameRequired));

    public static string NameTooLong(int maxLength)
    {
        return Format(nameof(NameTooLong), maxLength);
    }

    public static string ScheduleTextRequired => GetString(nameof(ScheduleTextRequired));

    public static string ScheduleTextTooLong(int maxLength)
    {
        return Format(nameof(ScheduleTextTooLong), maxLength);
    }

    public static string TrainingStartTimeInvalid(string format)
    {
        return Format(nameof(TrainingStartTimeInvalid), format);
    }

    public static string InvalidTrainerId => GetString(nameof(InvalidTrainerId));

    public static string OnlyActiveCoachesCanBeAssigned => GetString(nameof(OnlyActiveCoachesCanBeAssigned));

    public static string TrainingGroupCreatedDescription(string actorLogin, string groupName)
    {
        return Format(nameof(TrainingGroupCreatedDescription), actorLogin, groupName);
    }

    public static string TrainingGroupUpdatedDescription(string actorLogin, string groupName)
    {
        return Format(nameof(TrainingGroupUpdatedDescription), actorLogin, groupName);
    }

    public static string TrainingGroupTrainersUpdatedDescription(string actorLogin, string groupName)
    {
        return Format(nameof(TrainingGroupTrainersUpdatedDescription), actorLogin, groupName);
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
