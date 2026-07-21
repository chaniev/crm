using GymCrm.Domain.Clients;

namespace GymCrm.Tests;

public sealed class ClientNotesMetadataPolicyTests
{
    [Fact]
    public void Apply_SetsChangesAndClearsMetadataWhilePreservingNoOp()
    {
        var firstActor = Guid.NewGuid();
        var secondActor = Guid.NewGuid();
        var now = new DateTimeOffset(2026, 7, 21, 10, 11, 12, 987, TimeSpan.FromHours(3));
        var client = new Client();

        Assert.Equal("set", ClientNotesMetadataPolicy.Apply(client, "note", firstActor, now));
        Assert.Equal("note", client.Notes);
        Assert.Equal(firstActor, client.NotesChangedByUserId);
        Assert.Equal(new DateTimeOffset(2026, 7, 21, 7, 11, 12, TimeSpan.Zero), client.NotesChangedAt);

        Assert.Null(ClientNotesMetadataPolicy.Apply(client, "note", secondActor, now.AddMinutes(1)));
        Assert.Equal(firstActor, client.NotesChangedByUserId);

        Assert.Equal("changed", ClientNotesMetadataPolicy.Apply(client, "other", secondActor, now.AddMinutes(1)));
        Assert.Equal(secondActor, client.NotesChangedByUserId);

        Assert.Equal("cleared", ClientNotesMetadataPolicy.Apply(client, null, secondActor, now.AddMinutes(2)));
        Assert.Null(client.NotesChangedByUserId);
        Assert.Null(client.NotesChangedAt);
    }

    [Fact]
    public void NormalizeUtcToSeconds_DropsSubsecondsAndConvertsOffset()
    {
        var value = new DateTimeOffset(2026, 7, 21, 10, 11, 12, 999, TimeSpan.FromHours(3));

        var result = ClientNotesMetadataPolicy.NormalizeUtcToSeconds(value);

        Assert.Equal(TimeSpan.Zero, result.Offset);
        Assert.Equal(0, result.Millisecond);
        Assert.Equal(new DateTimeOffset(2026, 7, 21, 7, 11, 12, TimeSpan.Zero), result);
    }
}
