using GymCrm.Application.Clients;

namespace GymCrm.Infrastructure.Clients;

internal interface IClientPhotoImageProcessor
{
    ClientPhotoImageProcessingResult ConvertHeifToJpeg(byte[] sourceBytes);
}

internal readonly record struct ClientPhotoImageProcessingResult(
    ClientPhotoError Error,
    byte[]? Content,
    string? ContentType,
    string? FileExtension)
{
    public bool Succeeded => Error == ClientPhotoError.None;

    public static ClientPhotoImageProcessingResult Success(
        byte[] content,
        string contentType,
        string fileExtension) =>
        new(ClientPhotoError.None, content, contentType, fileExtension);

    public static ClientPhotoImageProcessingResult Failure(ClientPhotoError error) =>
        new(error, null, null, null);
}
