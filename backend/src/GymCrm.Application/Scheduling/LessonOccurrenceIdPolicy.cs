using System.Security.Cryptography;
using System.Text;

namespace GymCrm.Application.Scheduling;

public static class LessonOccurrenceIdPolicy
{
    public static readonly Guid RecurringNamespace = Guid.Parse("a4b0c93e-e5d5-56ba-b9c1-236bd3254960");
    public static readonly Guid LegacyAttendanceNamespace = Guid.Parse("51897eb3-fa5e-5206-89f6-a1cec037392e");

    public static Guid CreateRecurring(Guid slotLineageId, DateOnly lessonDate)
    {
        return Create(
            RecurringNamespace,
            $"lesson-slot-lineage:{slotLineageId:D}:{lessonDate:yyyy-MM-dd}");
    }

    public static Guid CreateLegacyAttendance(Guid groupId, DateOnly trainingDate)
    {
        return Create(
            LegacyAttendanceNamespace,
            $"legacy-attendance:{groupId:D}:{trainingDate:yyyy-MM-dd}");
    }

    public static Guid Create(Guid namespaceId, string canonicalKey)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(canonicalKey);

        Span<byte> namespaceBytes = stackalloc byte[16];
        WriteNetworkOrder(namespaceId, namespaceBytes);

        var nameBytes = Encoding.UTF8.GetBytes(canonicalKey);
        var combined = new byte[namespaceBytes.Length + nameBytes.Length];
        namespaceBytes.CopyTo(combined);
        nameBytes.CopyTo(combined.AsSpan(namespaceBytes.Length));

        Span<byte> hash = stackalloc byte[20];
        if (!SHA1.TryHashData(combined, hash, out var bytesWritten) || bytesWritten != hash.Length)
        {
            throw new InvalidOperationException("Unable to compute lesson occurrence UUID hash.");
        }

        Span<byte> uuidBytes = stackalloc byte[16];
        hash[..16].CopyTo(uuidBytes);
        uuidBytes[6] = (byte)((uuidBytes[6] & 0x0F) | 0x50);
        uuidBytes[8] = (byte)((uuidBytes[8] & 0x3F) | 0x80);

        return CreateFromNetworkOrder(uuidBytes);
    }

    private static void WriteNetworkOrder(Guid value, Span<byte> destination)
    {
        if (!value.TryWriteBytes(destination))
        {
            throw new InvalidOperationException("Unable to write UUID bytes.");
        }

        destination[..4].Reverse();
        destination.Slice(4, 2).Reverse();
        destination.Slice(6, 2).Reverse();
    }

    private static Guid CreateFromNetworkOrder(ReadOnlySpan<byte> source)
    {
        Span<byte> localOrder = stackalloc byte[16];
        source.CopyTo(localOrder);
        localOrder[..4].Reverse();
        localOrder.Slice(4, 2).Reverse();
        localOrder.Slice(6, 2).Reverse();
        return new Guid(localOrder);
    }
}
