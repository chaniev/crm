namespace GymCrm.Api.Auth;

internal sealed record ClientPhotoSummaryResponse(
    string Path,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt,
    bool HasPhoto);
