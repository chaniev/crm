namespace GymCrm.Infrastructure.Messenger;

public sealed class ClientTelegramOptions
{
    public const string SectionName = "ClientTelegram";
    private const int MinBotUsernameLength = 5;
    private const int MaxBotUsernameLength = 32;

    public bool Enabled { get; set; }
    public string? BotToken { get; set; }
    public string? BotUsername { get; set; }
    public int LinkTokenTtlMinutes { get; set; } = 30;
    public int PollingIntervalSeconds { get; set; } = 2;
    public int PollingTimeoutSeconds { get; set; } = 20;
    public int BackoffSeconds { get; set; } = 10;
    public int MaxUpdatesPerPoll { get; set; } = 50;

    public string? NormalizedBotUsername
    {
        get
        {
            return NormalizeBotUsername(BotUsername);
        }
    }

    public bool HasBotToken => !string.IsNullOrWhiteSpace(BotToken);

    public static string? NormalizeBotUsername(string? value)
    {
        var username = value?.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            return null;
        }

        if (username.StartsWith('@'))
        {
            username = username[1..].Trim();
        }

        username = ExtractUsernameFromTelegramLink(username) ?? username;

        if (username.StartsWith('@'))
        {
            username = username[1..].Trim();
        }

        return IsValidBotUsername(username) ? username : null;
    }

    private static string? ExtractUsernameFromTelegramLink(string value)
    {
        var candidate = value;
        if (candidate.StartsWith("t.me/", StringComparison.OrdinalIgnoreCase) ||
            candidate.StartsWith("telegram.me/", StringComparison.OrdinalIgnoreCase))
        {
            candidate = $"https://{candidate}";
        }

        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri) ||
            !IsTelegramHost(uri.Host))
        {
            return null;
        }

        var segments = uri.AbsolutePath.Split(
            '/',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return segments.Length == 0 ? null : Uri.UnescapeDataString(segments[0]);
    }

    private static bool IsTelegramHost(string host)
    {
        return host.Equals("t.me", StringComparison.OrdinalIgnoreCase) ||
               host.Equals("telegram.me", StringComparison.OrdinalIgnoreCase) ||
               host.Equals("www.t.me", StringComparison.OrdinalIgnoreCase) ||
               host.Equals("www.telegram.me", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsValidBotUsername(string username)
    {
        if (username.Length is < MinBotUsernameLength or > MaxBotUsernameLength ||
            !username.EndsWith("bot", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        foreach (var character in username)
        {
            if (!char.IsAsciiLetterOrDigit(character) && character != '_')
            {
                return false;
            }
        }

        return true;
    }
}
