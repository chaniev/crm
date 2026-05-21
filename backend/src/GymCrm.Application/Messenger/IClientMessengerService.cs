using GymCrm.Domain.Users;

namespace GymCrm.Application.Messenger;

public interface IClientMessengerService
{
    Task<ClientMessengerResult<ClientMessengerSummary>> GetTelegramSummaryAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default);

    Task<ClientMessengerResult<ClientMessengerMessagePage>> ListTelegramMessagesAsync(
        Guid clientId,
        User currentUser,
        int? skip,
        int? take,
        CancellationToken cancellationToken = default);

    Task<ClientMessengerResult<ClientMessengerLinkTokenInfo>> CreateTelegramLinkTokenAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default);

    Task<ClientMessengerResult<ClientMessengerMessageItem>> SendTelegramMessageAsync(
        Guid clientId,
        User currentUser,
        string text,
        string? idempotencyKey,
        CancellationToken cancellationToken = default);

    Task<ClientMessengerResult<ClientMessengerReadStateInfo>> MarkTelegramReadAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default);

    Task<ClientTelegramUpdateHandleResult> HandleTelegramUpdateAsync(
        ClientTelegramIncomingUpdate update,
        CancellationToken cancellationToken = default);
}
