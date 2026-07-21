namespace GymCrm.Domain.Clients;

public static class ClientMembershipCommentPolicy
{
    public const int MaxLength = 2000;

    public static string? Normalize(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized?.Length > MaxLength)
        {
            throw new ArgumentException($"Comment must not exceed {MaxLength} characters.", nameof(value));
        }
        return normalized;
    }

    public static string? Apply(ClientMembershipSale sale, string? value, Guid actorId, DateTimeOffset changedAt)
    {
        var normalized = Normalize(value);
        if (string.Equals(sale.Comment, normalized, StringComparison.Ordinal)) return null;
        var transition = normalized is null ? "cleared" : sale.Comment is null ? "set" : "changed";
        sale.Comment = normalized;
        sale.CommentChangedByUserId = actorId;
        sale.CommentChangedAt = NormalizeUtcToSeconds(changedAt);
        return transition;
    }

    public static DateTimeOffset NormalizeUtcToSeconds(DateTimeOffset value) =>
        new(value.UtcDateTime.Ticks - value.UtcDateTime.Ticks % TimeSpan.TicksPerSecond, TimeSpan.Zero);
}
