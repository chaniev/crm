namespace GymCrm.Api.Startup;

internal sealed class BrandingOptions
{
    public const string SectionName = "Branding";
    public const string DefaultClubName = "Gym CRM";
    public const string DefaultThemeId = "default-green-v1";
    public const string DefaultAuthBackgroundImageId = "k4pro-login-v1";

    public string? ClubName { get; init; }
    public string? ThemeId { get; init; }
    public string? AuthBackgroundImageId { get; init; }

    public string ResolveClubName()
    {
        return ResolveConfiguredValue(ClubName, DefaultClubName);
    }

    public string ResolveThemeId()
    {
        return ResolveConfiguredValue(ThemeId, DefaultThemeId);
    }

    public string ResolveAuthBackgroundImageId()
    {
        return ResolveConfiguredValue(AuthBackgroundImageId, DefaultAuthBackgroundImageId);
    }

    private static string ResolveConfiguredValue(string? value, string defaultValue)
    {
        return string.IsNullOrWhiteSpace(value)
            ? defaultValue
            : value.Trim();
    }
}
