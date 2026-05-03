namespace GymCrm.Api.Auth;

internal static class AuditLogApiConstants
{
    public const string RoutePrefix = "/audit-logs";
    public const string ListRoute = "/";
    public const string OptionsRoute = "/options";
    public const int DefaultPage = 1;
    public const int DefaultTake = 20;
    public const int MaxTake = 100;
    public const string DateFormat = "yyyy-MM-dd";
}
