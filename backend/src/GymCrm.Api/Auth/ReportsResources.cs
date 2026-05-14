using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class ReportsResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.ReportsResources",
        typeof(ReportsResources).Assembly);

    public static string PeriodPresetRequired => GetString(nameof(PeriodPresetRequired));

    public static string PeriodPresetInvalid => GetString(nameof(PeriodPresetInvalid));

    public static string AnchorDateRequired => GetString(nameof(AnchorDateRequired));

    public static string AnchorDateNotAllowedForCustom => GetString(nameof(AnchorDateNotAllowedForCustom));

    public static string AnchorDateInvalid => DateMustUseFormat(ReportsApiConstants.DateFormat);

    public static string FromRequiredForCustom => GetString(nameof(FromRequiredForCustom));

    public static string ToRequiredForCustom => GetString(nameof(ToRequiredForCustom));

    public static string FromNotAllowedForPreset => GetString(nameof(FromNotAllowedForPreset));

    public static string ToNotAllowedForPreset => GetString(nameof(ToNotAllowedForPreset));

    public static string ToCannotBeBeforeFrom => GetString(nameof(ToCannotBeBeforeFrom));

    public static string BranchIdInvalid => GetString(nameof(BranchIdInvalid));

    public static string BranchMustExist => GetString(nameof(BranchMustExist));

    public static string TrainerIdInvalid => GetString(nameof(TrainerIdInvalid));

    public static string TrainerMustExist => GetString(nameof(TrainerMustExist));

    public static string TrainerMustBeCoach => GetString(nameof(TrainerMustBeCoach));

    public static string DateMustUseFormat(string dateFormat)
    {
        return Format(nameof(DateMustUseFormat), dateFormat);
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
