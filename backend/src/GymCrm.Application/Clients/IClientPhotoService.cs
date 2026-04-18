namespace GymCrm.Application.Clients;

public interface IClientPhotoService
{
    Task<ClientPhotoUploadResult> UploadAsync(
        Guid clientId,
        ClientPhotoUploadCommand command,
        CancellationToken cancellationToken);

    Task<ClientPhotoReadResult> OpenReadAsync(
        Guid clientId,
        ClientPhotoReadCommand command,
        CancellationToken cancellationToken);
}

public sealed class ClientPhotoUploadCommand
{
    public required Guid RequestedByUserId { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public required Stream Content { get; init; }
}

public sealed record ClientPhotoReadCommand(Guid RequestedByUserId);

public enum ClientPhotoError
{
    None = 0,
    InvalidRequest = 1,
    UserMissing = 2,
    ClientMissing = 3,
    Forbidden = 4,
    PhotoMissing = 5,
    FileTooLarge = 6,
    UnsupportedMediaType = 7,
    InvalidImageContent = 8,
    ConversionUnavailable = 9
}

public sealed record ClientPhotoMetadataResult(
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt);

public readonly record struct ClientPhotoUploadResult(
    ClientPhotoError Error,
    ClientPhotoMetadataResult? Photo)
{
    public bool Succeeded => Error == ClientPhotoError.None;

    public static ClientPhotoUploadResult Success(ClientPhotoMetadataResult photo) =>
        new(ClientPhotoError.None, photo);

    public static ClientPhotoUploadResult Failure(ClientPhotoError error) =>
        new(error, null);
}

public readonly record struct ClientPhotoReadResult(
    ClientPhotoError Error,
    ClientPhotoContentResult? Photo)
{
    public bool Succeeded => Error == ClientPhotoError.None;

    public static ClientPhotoReadResult Success(ClientPhotoContentResult photo) =>
        new(ClientPhotoError.None, photo);

    public static ClientPhotoReadResult Failure(ClientPhotoError error) =>
        new(error, null);
}

public sealed class ClientPhotoContentResult(
    Stream content,
    string contentType,
    long sizeBytes,
    DateTimeOffset uploadedAt) : IAsyncDisposable
{
    public Stream Content { get; } = content;
    public string ContentType { get; } = contentType;
    public long SizeBytes { get; } = sizeBytes;
    public DateTimeOffset UploadedAt { get; } = uploadedAt;

    public ValueTask DisposeAsync() => Content.DisposeAsync();
}
