namespace GymCrm.Api.SeedData;

internal sealed record SeedDataOptions
{
    public required string ConnectionString { get; init; }
    public required string PhotoStorageRootPath { get; init; }
    public bool ApplyMigrations { get; init; } = true;
    public bool ShowHelp { get; init; }

    public static SeedDataOptions Help => new()
    {
        ConnectionString = string.Empty,
        PhotoStorageRootPath = string.Empty,
        ApplyMigrations = false,
        ShowHelp = true
    };
}
