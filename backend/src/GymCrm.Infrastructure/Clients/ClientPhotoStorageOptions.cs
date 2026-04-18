namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientPhotoStorageOptions
{
    public const string SectionName = "ClientPhoto";

    public long MaxUploadSizeBytes { get; set; } = 10 * 1024 * 1024;

    public string StorageRootPath { get; set; } = Path.Combine(
        AppContext.BaseDirectory,
        "uploads",
        "client-photos");
}
