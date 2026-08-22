namespace GymCrm.Application.Messenger;

public static class ClientMessengerAuditConstants
{
    public const string TelegramPlatform = "Telegram";
    public const string EntityType = "ClientMessenger";
    public const string LinkTokenCreatedAction = "ClientMessengerTelegramLinkTokenCreated";
    public const string AccountLinkedAction = "ClientMessengerTelegramAccountLinked";
    public const string ConversationViewedAction = "ClientMessengerTelegramConversationViewed";
    public const string OutboundMessageSentAction = "ClientMessengerTelegramOutboundMessageSent";
}

public enum ClientMessengerError
{
    None = 0,
    NotFound = 1,
    Forbidden = 2,
    Validation = 3,
    NotConnected = 4,
    BotNotConfigured = 5,
    TelegramTransportFailure = 6,
    IdempotencyConflict = 7
}

public enum ClientMessengerConnectionStatus
{
    NotConnected = 1,
    PendingLink = 2,
    Connected = 3
}

public enum ClientTelegramUpdateHandleStatus
{
    Ignored = 1,
    Duplicate = 2,
    AccountLinked = 3,
    MessageReceived = 4,
    InvalidToken = 5,
    ExpiredToken = 6,
    AccountConflict = 7,
    UnknownAccount = 8
}

public sealed record ClientMessengerCapabilities(
    bool Visible,
    bool CanRead,
    bool CanReply,
    bool CanCreateLink,
    bool CanShowQr);

public sealed record ClientMessengerConnection(
    string Status,
    DateTimeOffset? LinkedAt,
    string? TelegramUsername,
    string? TelegramDisplayName,
    DateTimeOffset? PendingLinkExpiresAt);

public sealed record ClientMessengerLatestMessage(
    Guid Id,
    string Direction,
    string Status,
    string Text,
    DateTimeOffset CreatedAt);

public sealed record ClientMessengerSummary(
    string Platform,
    ClientMessengerCapabilities Capabilities,
    ClientMessengerConnection Connection,
    int UnreadCount,
    int TotalMessageCount,
    DateTimeOffset? LatestMessageAt,
    ClientMessengerLatestMessage? LatestMessage);

public sealed record ClientMessengerMessageItem(
    Guid Id,
    string Direction,
    string Status,
    string Text,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SentAt,
    DateTimeOffset? FailedAt,
    string? FailureReason,
    string? CreatedByUserName,
    string? TelegramUsername,
    string? TelegramDisplayName);

public sealed record ClientMessengerMessagePage(
    string Platform,
    IReadOnlyList<ClientMessengerMessageItem> Items,
    int Skip,
    int Take,
    int TotalCount,
    bool HasMore);

public sealed record ClientMessengerLinkTokenInfo(
    string Platform,
    string DeepLinkUrl,
    string QrCodeSvg,
    DateTimeOffset ExpiresAt,
    ClientMessengerConnection Connection);

public sealed record ClientMessengerReadStateInfo(
    string Platform,
    DateTimeOffset LastReadAt,
    int UnreadCount);

public sealed record ClientMessengerResult<T>(
    ClientMessengerError Error,
    T? Value,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == ClientMessengerError.None;

    public static ClientMessengerResult<T> Success(T value) => new(ClientMessengerError.None, value);

    public static ClientMessengerResult<T> Failure(ClientMessengerError error) => new(error, default);

    public static ClientMessengerResult<T> Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(ClientMessengerError.Validation, default, errors);
}

public sealed record ClientTelegramIncomingUpdate(
    long UpdateId,
    long? MessageId,
    string? ChatId,
    string? UserId,
    string? Username,
    string? FirstName,
    string? LastName,
    string? Text,
    DateTimeOffset? SentAt);

public sealed record ClientTelegramBotIdentity(string Username);

public sealed record ClientTelegramUpdateHandleResult(
    ClientTelegramUpdateHandleStatus Status,
    Guid? ClientId = null,
    Guid? MessageId = null);

public sealed record ClientTelegramSendMessageResult(
    bool Succeeded,
    long? MessageId = null,
    string? ChatId = null,
    string? ErrorMessage = null);
