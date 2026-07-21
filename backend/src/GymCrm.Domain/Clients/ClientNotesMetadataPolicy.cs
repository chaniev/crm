namespace GymCrm.Domain.Clients;

public static class ClientNotesMetadataPolicy
{
    public static DateTimeOffset NormalizeUtcToSeconds(DateTimeOffset value)
    {
        var utc = value.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute, utc.Second, TimeSpan.Zero);
    }

    public static string? Apply(Client client, string? normalizedNotes, Guid actorId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(client);

        if (string.Equals(client.Notes, normalizedNotes, StringComparison.Ordinal))
        {
            return null;
        }

        var transition = normalizedNotes is null ? "cleared" : client.Notes is null ? "set" : "changed";
        client.Notes = normalizedNotes;
        if (normalizedNotes is null)
        {
            client.NotesChangedByUserId = null;
            client.NotesChangedAt = null;
        }
        else
        {
            client.NotesChangedByUserId = actorId;
            client.NotesChangedAt = NormalizeUtcToSeconds(now);
        }

        return transition;
    }
}
