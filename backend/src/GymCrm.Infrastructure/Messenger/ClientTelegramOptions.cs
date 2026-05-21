namespace GymCrm.Infrastructure.Messenger;

public sealed class ClientTelegramOptions
{
    public const string SectionName = "ClientTelegram";

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
            var username = BotUsername?.Trim();
            if (string.IsNullOrWhiteSpace(username))
            {
                return null;
            }

            return username.StartsWith('@') ? username[1..] : username;
        }
    }

    public bool HasBotToken => !string.IsNullOrWhiteSpace(BotToken);
}
