namespace GymCrm.Api.Startup;

internal sealed class BrandingOptions
{
    public const string SectionName = "Branding";
    public const string DefaultClubName = "Gym CRM";

    public string? ClubName { get; init; }

    public string ResolveClubName()
    {
        return string.IsNullOrWhiteSpace(ClubName)
            ? DefaultClubName
            : ClubName.Trim();
    }
}
