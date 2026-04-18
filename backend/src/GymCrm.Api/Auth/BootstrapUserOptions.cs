namespace GymCrm.Api.Auth;

internal sealed class BootstrapUserOptions
{
    public const string SectionName = "BootstrapUser";

    public string Login { get; init; } = "headcoach";
    public string FullName { get; init; } = "Главный тренер";
}
