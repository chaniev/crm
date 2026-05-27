namespace GymCrm.Api.SeedData;

internal sealed record ClientPhotoSeedInfo(
    string RelativePath,
    string ContentType,
    long SizeBytes);
