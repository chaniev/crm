using GymCrm.Application.Clients;
using ImageMagick;

namespace GymCrm.Infrastructure.Clients;

internal sealed class MagickClientPhotoImageProcessor : IClientPhotoImageProcessor
{
    private const int MaxSidePixels = 1024;
    private const uint JpegQuality = 90;

    public ClientPhotoImageProcessingResult ConvertHeifToJpeg(byte[] sourceBytes)
    {
        ArgumentNullException.ThrowIfNull(sourceBytes);

        try
        {
            using var image = new MagickImage(sourceBytes);

            image.AutoOrient();
            image.Resize(new MagickGeometry(MaxSidePixels, MaxSidePixels)
            {
                Greater = true
            });
            image.Strip();
            image.Quality = JpegQuality;

            return ClientPhotoImageProcessingResult.Success(
                image.ToByteArray(MagickFormat.Jpeg),
                "image/jpeg",
                "jpg");
        }
        catch (MagickMissingDelegateErrorException)
        {
            return ClientPhotoImageProcessingResult.Failure(
                ClientPhotoError.ConversionUnavailable);
        }
        catch (MagickException)
        {
            return ClientPhotoImageProcessingResult.Failure(
                ClientPhotoError.InvalidImageContent);
        }
    }
}
