using System.ComponentModel.DataAnnotations;

namespace GymCrm.Api.Auth;

internal sealed class BotInternalApiOptions
{
    public const string SectionName = "BotInternalApi";

    public bool Enabled { get; set; } = true;

    [MaxLength(512)]
    public string? Token { get; set; }
}
