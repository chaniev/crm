using System.ComponentModel.DataAnnotations;

namespace GymCrm.Api.Startup;

internal sealed class TechnicalLoggingOptions
{
    public const string SectionName = "TechnicalLogging";

    public bool Enabled { get; init; } = true;

    [Required]
    public string DirectoryPath { get; init; } = "logs/technical";

    [Required]
    public string FileNamePrefix { get; init; } = "gym-crm-api";

    [Range(1, 1024)]
    public int FileSizeLimitMb { get; init; } = 20;

    [Range(1, 365)]
    public int RetentionDays { get; init; } = 10;
}
