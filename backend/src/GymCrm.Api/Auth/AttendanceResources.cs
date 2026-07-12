using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class AttendanceResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.AttendanceResources",
        typeof(AttendanceResources).Assembly);

    public static string InvalidTrainingDate(string format)
    {
        return Format(nameof(InvalidTrainingDate), format);
    }

    public static string AttendanceMarksRequired => GetString(nameof(AttendanceMarksRequired));

    public static string AttendanceSaveInvalidRequest => GetString(nameof(AttendanceSaveInvalidRequest));

    public static string AttendanceSaveClientOutsideGroup => GetString(nameof(AttendanceSaveClientOutsideGroup));

    public static string AttendanceSaveFailed => GetString(nameof(AttendanceSaveFailed));
    public static string AttendanceStateInvalid => GetString(nameof(AttendanceStateInvalid));
    public static string TrainingDateInFuture => GetString(nameof(TrainingDateInFuture));
    public static string SingleVisitRestoreConflict => GetString(nameof(SingleVisitRestoreConflict));

    public static string NoCurrentMembershipWarning => GetString(nameof(NoCurrentMembershipWarning));

    public static string MembershipPurchasedLaterWarning => GetString(nameof(MembershipPurchasedLaterWarning));

    public static string MembershipUnpaidWarning => GetString(nameof(MembershipUnpaidWarning));

    public static string SingleVisitAlreadyUsedWarning => GetString(nameof(SingleVisitAlreadyUsedWarning));

    public static string MembershipExpiredWarning => GetString(nameof(MembershipExpiredWarning));

    public static string MembershipWarningWithDetails(string details)
    {
        return Format(nameof(MembershipWarningWithDetails), details);
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
