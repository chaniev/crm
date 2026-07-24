using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace GymCrm.Api.SeedData;

internal sealed class SeedClientPhotoWriter
{
    private const string ContentType = "image/png";
    private const int Width = 96;
    private const int Height = 96;

    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    private static readonly uint[] CrcTable = BuildCrcTable();

    public SeedClientPhotoWriter(string storageRootPath)
    {
        StorageRootPath = storageRootPath;
    }

    public string StorageRootPath { get; }

    public async Task<ClientPhotoSeedInfo> WritePhotoAsync(
        int clientNumber,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(StorageRootPath);

        var relativePath = GetRelativePath(clientNumber);
        var bytes = CreatePngBytes(clientNumber);
        var absolutePath = Path.Combine(StorageRootPath, relativePath);

        await File.WriteAllBytesAsync(absolutePath, bytes, cancellationToken);

        return new ClientPhotoSeedInfo(relativePath, ContentType, bytes.LongLength);
    }

    public Task DeleteSeedPhotosAsync(
        int clientCount,
        CancellationToken cancellationToken)
    {
        if (!Directory.Exists(StorageRootPath))
        {
            return Task.CompletedTask;
        }

        for (var clientNumber = 1; clientNumber <= clientCount; clientNumber++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var absolutePath = Path.Combine(StorageRootPath, GetRelativePath(clientNumber));
            if (File.Exists(absolutePath))
            {
                File.Delete(absolutePath);
            }
        }

        return Task.CompletedTask;
    }

    private static string GetRelativePath(int clientNumber) =>
        $"seed-client-{clientNumber:000}.png";

    private static byte[] CreatePngBytes(int clientNumber)
    {
        var raw = CreateRawImage(clientNumber);
        var compressed = Compress(raw);

        using var png = new MemoryStream();
        png.Write(PngSignature);
        WriteChunk(png, "IHDR", CreateHeader());
        WriteChunk(png, "IDAT", compressed);
        WriteChunk(png, "IEND", []);

        return png.ToArray();
    }

    private static byte[] CreateRawImage(int clientNumber)
    {
        var raw = new byte[(Width * 3 + 1) * Height];
        var seed = (uint)(clientNumber * 2_654_435_761);
        var redBase = 40 + (byte)(seed % 160);
        var greenBase = 40 + (byte)((seed >> 8) % 160);
        var blueBase = 40 + (byte)((seed >> 16) % 160);
        var offset = 0;

        for (var y = 0; y < Height; y++)
        {
            raw[offset++] = 0;

            for (var x = 0; x < Width; x++)
            {
                var diagonal = (x + y + clientNumber) % 48;
                raw[offset++] = (byte)((redBase + x + diagonal) % 256);
                raw[offset++] = (byte)((greenBase + y + diagonal) % 256);
                raw[offset++] = (byte)((blueBase + x / 2 + y / 2) % 256);
            }
        }

        return raw;
    }

    private static byte[] CreateHeader()
    {
        var header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(0, 4), Width);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4, 4), Height);
        header[8] = 8;
        header[9] = 2;
        header[10] = 0;
        header[11] = 0;
        header[12] = 0;

        return header;
    }

    private static byte[] Compress(byte[] raw)
    {
        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.SmallestSize, leaveOpen: true))
        {
            zlib.Write(raw);
        }

        return compressed.ToArray();
    }

    private static void WriteChunk(Stream stream, string type, byte[] data)
    {
        Span<byte> lengthBytes = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(lengthBytes, data.Length);
        stream.Write(lengthBytes);

        var typeBytes = Encoding.ASCII.GetBytes(type);
        stream.Write(typeBytes);
        stream.Write(data);

        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, ComputeCrc(typeBytes, data));
        stream.Write(crcBytes);
    }

    private static uint ComputeCrc(byte[] typeBytes, byte[] data)
    {
        var crc = 0xffffffffu;
        crc = UpdateCrc(crc, typeBytes);
        crc = UpdateCrc(crc, data);

        return crc ^ 0xffffffffu;
    }

    private static uint UpdateCrc(uint crc, byte[] bytes)
    {
        foreach (var value in bytes)
        {
            crc = CrcTable[(crc ^ value) & 0xff] ^ (crc >> 8);
        }

        return crc;
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];

        for (var index = 0; index < table.Length; index++)
        {
            var value = (uint)index;

            for (var bit = 0; bit < 8; bit++)
            {
                value = (value & 1) == 1
                    ? 0xedb88320u ^ (value >> 1)
                    : value >> 1;
            }

            table[index] = value;
        }

        return table;
    }
}
