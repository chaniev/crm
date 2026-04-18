using System.Buffers;
using System.Text;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.Clients;

internal sealed class ClientPhotoService(
    GymCrmDbContext dbContext,
    IOptions<ClientPhotoStorageOptions> storageOptions,
    IClientPhotoImageProcessor imageProcessor,
    ILogger<ClientPhotoService> logger) : IClientPhotoService
{
    private static readonly IReadOnlyDictionary<string, DetectedPhotoFormat> FormatsByExtension =
        new Dictionary<string, DetectedPhotoFormat>(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = DetectedPhotoFormat.Jpeg,
            [".jpeg"] = DetectedPhotoFormat.Jpeg,
            [".png"] = DetectedPhotoFormat.Png,
            [".webp"] = DetectedPhotoFormat.WebP,
            [".heic"] = DetectedPhotoFormat.Heic,
            [".heif"] = DetectedPhotoFormat.Heif
        };

    private static readonly IReadOnlyDictionary<string, DetectedPhotoFormat> FormatsByContentType =
        new Dictionary<string, DetectedPhotoFormat>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = DetectedPhotoFormat.Jpeg,
            ["image/png"] = DetectedPhotoFormat.Png,
            ["image/webp"] = DetectedPhotoFormat.WebP,
            ["image/heic"] = DetectedPhotoFormat.Heic,
            ["image/heif"] = DetectedPhotoFormat.Heif
        };

    private readonly string storageRootPath = ResolveStorageRootPath(storageOptions.Value);
    private readonly long maxUploadSizeBytes = ResolveMaxUploadSizeBytes(storageOptions.Value);

    public async Task<ClientPhotoUploadResult> UploadAsync(
        Guid clientId,
        ClientPhotoUploadCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty ||
            command.RequestedByUserId == Guid.Empty ||
            string.IsNullOrWhiteSpace(command.FileName) ||
            string.IsNullOrWhiteSpace(command.ContentType) ||
            command.Content is null ||
            !command.Content.CanRead)
        {
            return ClientPhotoUploadResult.Failure(ClientPhotoError.InvalidRequest);
        }

        var actorRole = await LoadUserRoleAsync(command.RequestedByUserId, cancellationToken);
        if (actorRole is null)
        {
            return ClientPhotoUploadResult.Failure(ClientPhotoError.UserMissing);
        }

        if (!CanManagePhotos(actorRole.Value))
        {
            return ClientPhotoUploadResult.Failure(ClientPhotoError.Forbidden);
        }

        var client = await dbContext.Clients
            .SingleOrDefaultAsync(candidate => candidate.Id == clientId, cancellationToken);

        if (client is null)
        {
            return ClientPhotoUploadResult.Failure(ClientPhotoError.ClientMissing);
        }

        var contentBytes = await ReadContentAsync(command.Content, maxUploadSizeBytes, cancellationToken);
        if (contentBytes.Error is not null)
        {
            return ClientPhotoUploadResult.Failure(contentBytes.Error.Value);
        }

        var validatedPhoto = ValidateContent(
            command.FileName,
            command.ContentType,
            contentBytes.Content);

        if (validatedPhoto.Error is not null)
        {
            return ClientPhotoUploadResult.Failure(validatedPhoto.Error.Value);
        }

        var preparedPhoto = PrepareStorageContent(
            validatedPhoto.Format!.Value,
            contentBytes.Content,
            imageProcessor);

        if (preparedPhoto.Error is not null)
        {
            return ClientPhotoUploadResult.Failure(preparedPhoto.Error.Value);
        }

        var photoToStore = preparedPhoto.Value!;
        var oldPhotoPath = client.PhotoPath;
        var now = DateTimeOffset.UtcNow;
        var storedPhoto = await SaveNewPhotoAsync(
            client.Id,
            photoToStore,
            cancellationToken);

        try
        {
            client.PhotoPath = storedPhoto.RelativePath;
            client.PhotoContentType = storedPhoto.ContentType;
            client.PhotoSizeBytes = storedPhoto.SizeBytes;
            client.PhotoUploadedAt = now;
            client.UpdatedAt = now;

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeletePhotoIfExistsAsync(storedPhoto.RelativePath, CancellationToken.None);
            throw;
        }

        if (!string.IsNullOrWhiteSpace(oldPhotoPath) &&
            !string.Equals(oldPhotoPath, storedPhoto.RelativePath, StringComparison.Ordinal))
        {
            try
            {
                await DeletePhotoIfExistsAsync(oldPhotoPath, cancellationToken);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(
                    exception,
                    "Failed to delete replaced client photo '{PhotoPath}' for client '{ClientId}'.",
                    oldPhotoPath,
                    client.Id);
            }
        }

        return ClientPhotoUploadResult.Success(new ClientPhotoMetadataResult(
            storedPhoto.ContentType,
            storedPhoto.SizeBytes,
            now));
    }

    public async Task<ClientPhotoReadResult> OpenReadAsync(
        Guid clientId,
        ClientPhotoReadCommand command,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty || command.RequestedByUserId == Guid.Empty)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.InvalidRequest);
        }

        var actorRole = await LoadUserRoleAsync(command.RequestedByUserId, cancellationToken);
        if (actorRole is null)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.UserMissing);
        }

        var clientPhoto = await dbContext.Clients
            .AsNoTracking()
            .Where(client => client.Id == clientId)
            .Select(client => new ClientPhotoRecord(
                client.Id,
                client.PhotoPath,
                client.PhotoContentType,
                client.PhotoSizeBytes,
                client.PhotoUploadedAt))
            .SingleOrDefaultAsync(cancellationToken);

        if (clientPhoto is null)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.ClientMissing);
        }

        var hasAccess = actorRole.Value switch
        {
            UserRole.HeadCoach => true,
            UserRole.Administrator => true,
            UserRole.Coach => await dbContext.ClientGroups
                .Where(clientGroup => clientGroup.ClientId == clientId)
                .Join(
                    dbContext.GroupTrainers.Where(groupTrainer => groupTrainer.TrainerId == command.RequestedByUserId),
                    clientGroup => clientGroup.GroupId,
                    groupTrainer => groupTrainer.GroupId,
                    (_, _) => 1)
                .AnyAsync(cancellationToken),
            _ => false
        };

        if (!hasAccess)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.Forbidden);
        }

        if (string.IsNullOrWhiteSpace(clientPhoto.PhotoPath) ||
            string.IsNullOrWhiteSpace(clientPhoto.PhotoContentType) ||
            clientPhoto.PhotoSizeBytes is null ||
            clientPhoto.PhotoUploadedAt is null)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.PhotoMissing);
        }

        try
        {
            var absolutePath = ResolveAbsolutePhotoPath(clientPhoto.PhotoPath);
            var stream = new FileStream(
                absolutePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 64 * 1024,
                options: FileOptions.Asynchronous | FileOptions.SequentialScan);

            return ClientPhotoReadResult.Success(new ClientPhotoContentResult(
                stream,
                clientPhoto.PhotoContentType,
                clientPhoto.PhotoSizeBytes.Value,
                clientPhoto.PhotoUploadedAt.Value));
        }
        catch (FileNotFoundException)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.PhotoMissing);
        }
        catch (DirectoryNotFoundException)
        {
            return ClientPhotoReadResult.Failure(ClientPhotoError.PhotoMissing);
        }
    }

    private async Task<UserRole?> LoadUserRoleAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => (UserRole?)user.Role)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<SavedPhoto> SaveNewPhotoAsync(
        Guid clientId,
        PreparedPhoto photo,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(storageRootPath);

        var fileName = $"{clientId:N}-{Guid.NewGuid():N}.{photo.FileExtension}";
        var absolutePath = Path.Combine(storageRootPath, fileName);

        await File.WriteAllBytesAsync(absolutePath, photo.Content, cancellationToken);

        return new SavedPhoto(fileName, photo.ContentType, photo.Content.LongLength);
    }

    private async Task DeletePhotoIfExistsAsync(
        string relativePath,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var absolutePath = ResolveAbsolutePhotoPath(relativePath);
        if (!File.Exists(absolutePath))
        {
            return;
        }

        File.Delete(absolutePath);
        await Task.CompletedTask;
    }

    private string ResolveAbsolutePhotoPath(string relativePath)
    {
        var normalizedRelativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.GetFullPath(Path.Combine(storageRootPath, normalizedRelativePath));
        var expectedRoot = storageRootPath.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;

        if (!absolutePath.StartsWith(expectedRoot, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Client photo path '{relativePath}' resolves outside the storage root.");
        }

        return absolutePath;
    }

    private static string ResolveStorageRootPath(ClientPhotoStorageOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        return Path.GetFullPath(
            string.IsNullOrWhiteSpace(options.StorageRootPath)
                ? Path.Combine(AppContext.BaseDirectory, "uploads", "client-photos")
                : options.StorageRootPath);
    }

    private static long ResolveMaxUploadSizeBytes(ClientPhotoStorageOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        return options.MaxUploadSizeBytes > 0
            ? options.MaxUploadSizeBytes
            : 10 * 1024 * 1024;
    }

    private static bool CanManagePhotos(UserRole role) =>
        role is UserRole.HeadCoach or UserRole.Administrator;

    private static PreparedPhotoResult PrepareStorageContent(
        DetectedPhotoFormat format,
        byte[] content,
        IClientPhotoImageProcessor imageProcessor)
    {
        if (!format.RequiresConversion)
        {
            return PreparedPhotoResult.Success(new PreparedPhoto(
                content,
                format.ContentType,
                format.StoredFileExtension));
        }

        var conversionResult = imageProcessor.ConvertHeifToJpeg(content);
        if (!conversionResult.Succeeded ||
            conversionResult.Content is null ||
            conversionResult.ContentType is null ||
            conversionResult.FileExtension is null)
        {
            return PreparedPhotoResult.Failure(conversionResult.Error);
        }

        return PreparedPhotoResult.Success(new PreparedPhoto(
            conversionResult.Content,
            conversionResult.ContentType,
            conversionResult.FileExtension));
    }

    private static ValidatedPhotoResult ValidateContent(
        string fileName,
        string contentType,
        byte[] content)
    {
        if (content.Length == 0)
        {
            return ValidatedPhotoResult.Failure(ClientPhotoError.InvalidImageContent);
        }

        var extension = Path.GetExtension(fileName);
        if (!FormatsByExtension.TryGetValue(extension, out var extensionFormat))
        {
            return ValidatedPhotoResult.Failure(ClientPhotoError.UnsupportedMediaType);
        }

        if (!FormatsByContentType.TryGetValue(NormalizeContentType(contentType), out var contentTypeFormat))
        {
            return ValidatedPhotoResult.Failure(ClientPhotoError.UnsupportedMediaType);
        }

        var detectedFormat = DetectFormat(content);
        if (detectedFormat is null ||
            detectedFormat.Value != extensionFormat ||
            detectedFormat.Value != contentTypeFormat)
        {
            return ValidatedPhotoResult.Failure(ClientPhotoError.UnsupportedMediaType);
        }

        return ValidatedPhotoResult.Success(detectedFormat.Value);
    }

    private static async Task<ReadContentResult> ReadContentAsync(
        Stream content,
        long maxUploadSizeBytes,
        CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var rentedBuffer = ArrayPool<byte>.Shared.Rent(64 * 1024);

        try
        {
            while (true)
            {
                var read = await content.ReadAsync(rentedBuffer.AsMemory(), cancellationToken);
                if (read == 0)
                {
                    break;
                }

                if (buffer.Length + read > maxUploadSizeBytes)
                {
                    return ReadContentResult.Failure(ClientPhotoError.FileTooLarge);
                }

                await buffer.WriteAsync(rentedBuffer.AsMemory(0, read), cancellationToken);
            }

            return ReadContentResult.Success(buffer.ToArray());
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(rentedBuffer);
        }
    }

    private static string NormalizeContentType(string contentType)
    {
        var separatorIndex = contentType.IndexOf(';');
        var normalized = separatorIndex >= 0
            ? contentType[..separatorIndex]
            : contentType;

        return normalized.Trim().ToLowerInvariant();
    }

    private static DetectedPhotoFormat? DetectFormat(ReadOnlySpan<byte> content)
    {
        if (content.Length >= 3 &&
            content[0] == 0xFF &&
            content[1] == 0xD8 &&
            content[2] == 0xFF)
        {
            return DetectedPhotoFormat.Jpeg;
        }

        if (content.Length >= 8 &&
            content[0] == 0x89 &&
            content[1] == 0x50 &&
            content[2] == 0x4E &&
            content[3] == 0x47 &&
            content[4] == 0x0D &&
            content[5] == 0x0A &&
            content[6] == 0x1A &&
            content[7] == 0x0A)
        {
            return DetectedPhotoFormat.Png;
        }

        if (content.Length >= 12 &&
            content[0] == 0x52 &&
            content[1] == 0x49 &&
            content[2] == 0x46 &&
            content[3] == 0x46 &&
            content[8] == 0x57 &&
            content[9] == 0x45 &&
            content[10] == 0x42 &&
            content[11] == 0x50)
        {
            return DetectedPhotoFormat.WebP;
        }

        if (content.Length < 16 ||
            content[4] != 0x66 ||
            content[5] != 0x74 ||
            content[6] != 0x79 ||
            content[7] != 0x70)
        {
            return null;
        }

        for (var offset = 8; offset + 4 <= Math.Min(content.Length, 64); offset += 4)
        {
            var brand = Encoding.ASCII.GetString(content[offset..(offset + 4)]);

            if (brand is "heic" or "heix" or "hevc" or "hevx" or "heim" or "heis")
            {
                return DetectedPhotoFormat.Heic;
            }

            if (brand is "heif" or "mif1" or "msf1")
            {
                return DetectedPhotoFormat.Heif;
            }
        }

        return null;
    }

    private sealed record ClientPhotoRecord(
        Guid ClientId,
        string? PhotoPath,
        string? PhotoContentType,
        long? PhotoSizeBytes,
        DateTimeOffset? PhotoUploadedAt);

    private sealed record SavedPhoto(
        string RelativePath,
        string ContentType,
        long SizeBytes);

    private sealed record PreparedPhoto(
        byte[] Content,
        string ContentType,
        string FileExtension);

    private readonly record struct PreparedPhotoResult(
        ClientPhotoError? Error,
        PreparedPhoto? Value)
    {
        public static PreparedPhotoResult Success(PreparedPhoto value) => new(null, value);

        public static PreparedPhotoResult Failure(ClientPhotoError error) => new(error, null);
    }

    private readonly record struct ReadContentResult(
        ClientPhotoError? Error,
        byte[] Content)
    {
        public static ReadContentResult Success(byte[] content) => new(null, content);

        public static ReadContentResult Failure(ClientPhotoError error) => new(error, []);
    }

    private readonly record struct ValidatedPhotoResult(
        ClientPhotoError? Error,
        DetectedPhotoFormat? Format)
    {
        public static ValidatedPhotoResult Success(DetectedPhotoFormat format) => new(null, format);

        public static ValidatedPhotoResult Failure(ClientPhotoError error) => new(error, null);
    }

    private readonly record struct DetectedPhotoFormat(
        string ContentType,
        string StoredFileExtension,
        bool RequiresConversion)
    {
        public static readonly DetectedPhotoFormat Jpeg = new("image/jpeg", "jpg", false);
        public static readonly DetectedPhotoFormat Png = new("image/png", "png", false);
        public static readonly DetectedPhotoFormat WebP = new("image/webp", "webp", false);
        public static readonly DetectedPhotoFormat Heic = new("image/heic", "jpg", true);
        public static readonly DetectedPhotoFormat Heif = new("image/heif", "jpg", true);
    }
}
