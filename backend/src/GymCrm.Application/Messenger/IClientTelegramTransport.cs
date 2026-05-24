namespace GymCrm.Application.Messenger;

public interface IClientTelegramTransport
{
    bool IsConfigured { get; }

    Task<ClientTelegramBotIdentity?> GetBotIdentityAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClientTelegramIncomingUpdate>> GetUpdatesAsync(
        long? offset,
        int limit,
        TimeSpan timeout,
        CancellationToken cancellationToken = default);

    Task<ClientTelegramSendMessageResult> SendTextMessageAsync(
        string telegramUserId,
        string text,
        CancellationToken cancellationToken = default);
}
