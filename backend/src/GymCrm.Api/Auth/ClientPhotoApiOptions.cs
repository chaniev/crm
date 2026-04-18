using System.ComponentModel.DataAnnotations;

namespace GymCrm.Api.Auth;

internal sealed class ClientPhotoApiOptions
{
    public const string SectionName = "ClientPhoto";
    public const string FormFieldName = "photo";
    public const long DefaultMaxUploadSizeBytes = 10 * 1024 * 1024;

    [Range(1, long.MaxValue)]
    public long MaxUploadSizeBytes { get; set; } = DefaultMaxUploadSizeBytes;

    [Required(AllowEmptyStrings = false)]
    public string StorageRootPath { get; set; } = "uploads/client-photos";
}
