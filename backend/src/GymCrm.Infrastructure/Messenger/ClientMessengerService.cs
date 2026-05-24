using GymCrm.Application.Audit;
using GymCrm.Application.Messenger;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.Messenger;

internal sealed class ClientMessengerService(
    GymCrmDbContext dbContext,
    IAuditLogService auditLogService,
    IClientTelegramTransport telegramTransport,
    IOptionsMonitor<ClientTelegramOptions> telegramOptions) : IClientMessengerService
{
    private const int DefaultMessageTake = 50;
    private const int MaxMessageTake = 100;

    public async Task<ClientMessengerResult<ClientMessengerSummary>> GetTelegramSummaryAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default)
    {
        if (!CanRead(currentUser))
        {
            return ClientMessengerResult<ClientMessengerSummary>.Failure(ClientMessengerError.Forbidden);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMessengerResult<ClientMessengerSummary>.Failure(ClientMessengerError.NotFound);
        }

        var summary = await BuildSummaryAsync(clientId, currentUser, cancellationToken);
        return ClientMessengerResult<ClientMessengerSummary>.Success(summary);
    }

    public async Task<ClientMessengerResult<ClientMessengerMessagePage>> ListTelegramMessagesAsync(
        Guid clientId,
        User currentUser,
        int? skip,
        int? take,
        CancellationToken cancellationToken = default)
    {
        if (!CanRead(currentUser))
        {
            return ClientMessengerResult<ClientMessengerMessagePage>.Failure(ClientMessengerError.Forbidden);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMessengerResult<ClientMessengerMessagePage>.Failure(ClientMessengerError.NotFound);
        }

        var errors = ValidatePaging(skip, take);
        if (errors.Count > 0)
        {
            return ClientMessengerResult<ClientMessengerMessagePage>.Validation(errors);
        }

        var resolvedSkip = skip ?? 0;
        var resolvedTake = take ?? DefaultMessageTake;
        var totalCount = await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .CountAsync(
                message => message.ClientId == clientId && message.Platform == MessengerPlatform.Telegram,
                cancellationToken);
        var messages = await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .Where(message => message.ClientId == clientId && message.Platform == MessengerPlatform.Telegram)
            .Include(message => message.CreatedByUser)
            .Include(message => message.Account)
            .OrderBy(message => message.CreatedAt)
            .ThenBy(message => message.Id)
            .Skip(resolvedSkip)
            .Take(resolvedTake)
            .ToArrayAsync(cancellationToken);
        var items = messages.Select(MapMessageItem).ToArray();

        return ClientMessengerResult<ClientMessengerMessagePage>.Success(new ClientMessengerMessagePage(
            MessengerPlatform.Telegram.ToString(),
            items,
            resolvedSkip,
            resolvedTake,
            totalCount,
            resolvedSkip + items.Length < totalCount));
    }

    public async Task<ClientMessengerResult<ClientMessengerLinkTokenInfo>> CreateTelegramLinkTokenAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default)
    {
        if (!CanCreateLink(currentUser))
        {
            return ClientMessengerResult<ClientMessengerLinkTokenInfo>.Failure(ClientMessengerError.Forbidden);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMessengerResult<ClientMessengerLinkTokenInfo>.Failure(ClientMessengerError.NotFound);
        }

        var options = telegramOptions.CurrentValue;
        var configuredBotUsername = options.NormalizedBotUsername;
        var botUsername = await ResolveBotUsernameAsync(configuredBotUsername, cancellationToken);
        if (botUsername is null)
        {
            return ClientMessengerResult<ClientMessengerLinkTokenInfo>.Validation(new Dictionary<string, string[]>
            {
                ["botUsername"] =
                [
                    "Имя клиентского Telegram-бота не настроено. " +
                    "Укажите ClientTelegram__BotUsername в формате gym_client_bot " +
                    "или настройте ClientTelegram__BotToken."
                ]
            });
        }

        var now = DateTimeOffset.UtcNow;
        var activeAccount = await GetActiveAccountAsync(clientId, cancellationToken);
        if (activeAccount is not null)
        {
            return ClientMessengerResult<ClientMessengerLinkTokenInfo>.Validation(new Dictionary<string, string[]>
            {
                ["connection"] = ["Telegram уже подключен к карточке клиента."]
            });
        }

        var activeTokens = await dbContext.ClientMessengerLinkTokens
            .Where(token =>
                token.ClientId == clientId &&
                token.Platform == MessengerPlatform.Telegram &&
                token.UsedAt == null &&
                token.ExpiresAt > now)
            .ToArrayAsync(cancellationToken);
        foreach (var activeToken in activeTokens)
        {
            activeToken.ExpiresAt = now;
        }

        var rawToken = MessengerHashing.CreateToken();
        var expiresAt = now.AddMinutes(Math.Clamp(options.LinkTokenTtlMinutes, 1, 24 * 60));
        var token = new ClientMessengerLinkToken
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Platform = MessengerPlatform.Telegram,
            TokenHash = MessengerHashing.ComputeSha256(rawToken),
            CreatedByUserId = currentUser.Id,
            CreatedAt = now,
            ExpiresAt = expiresAt
        };

        dbContext.ClientMessengerLinkTokens.Add(token);
        await dbContext.SaveChangesAsync(cancellationToken);

        var deepLinkUrl = $"https://t.me/{botUsername}?start={rawToken}";
        var qrCodeSvg = QrCodeSvgGenerator.GenerateSvg(deepLinkUrl);

        await auditLogService.WriteAsync(new AuditLogEntry(
            currentUser.Id,
            ClientMessengerAuditConstants.LinkTokenCreatedAction,
            ClientMessengerAuditConstants.EntityType,
            clientId.ToString(),
            $"Пользователь '{currentUser.Login}' создал ссылку подключения Telegram для клиента.",
            Source: "Web",
            MessengerPlatform: ClientMessengerAuditConstants.TelegramPlatform), cancellationToken);

        return ClientMessengerResult<ClientMessengerLinkTokenInfo>.Success(new ClientMessengerLinkTokenInfo(
            MessengerPlatform.Telegram.ToString(),
            deepLinkUrl,
            qrCodeSvg,
            expiresAt,
            new ClientMessengerConnection(
                ClientMessengerConnectionStatus.PendingLink.ToString(),
                null,
                null,
                null,
                expiresAt)));
    }

    public async Task<ClientMessengerResult<ClientMessengerMessageItem>> SendTelegramMessageAsync(
        Guid clientId,
        User currentUser,
        string text,
        string? idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        if (!CanReply(currentUser))
        {
            return ClientMessengerResult<ClientMessengerMessageItem>.Failure(ClientMessengerError.Forbidden);
        }

        var normalizedText = text.Trim();
        var errors = ValidateOutboundMessage(normalizedText, idempotencyKey);
        if (errors.Count > 0)
        {
            return ClientMessengerResult<ClientMessengerMessageItem>.Validation(errors);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMessengerResult<ClientMessengerMessageItem>.Failure(ClientMessengerError.NotFound);
        }

        var account = await GetActiveAccountAsync(clientId, cancellationToken);
        if (account is null)
        {
            return ClientMessengerResult<ClientMessengerMessageItem>.Failure(ClientMessengerError.NotConnected);
        }

        var normalizedIdempotencyKey = NormalizeOptional(idempotencyKey);
        var payloadHash = MessengerHashing.ComputeSha256(normalizedText);
        if (normalizedIdempotencyKey is not null)
        {
            var existingMessage = await dbContext.ClientMessengerMessages
                .AsNoTracking()
                .Where(message =>
                    message.ClientId == clientId &&
                    message.Platform == MessengerPlatform.Telegram &&
                    message.IdempotencyKey == normalizedIdempotencyKey)
                .Include(message => message.CreatedByUser)
                .Include(message => message.Account)
                .FirstOrDefaultAsync(cancellationToken);

            if (existingMessage is not null)
            {
                return existingMessage.IdempotencyPayloadHash == payloadHash
                    ? ClientMessengerResult<ClientMessengerMessageItem>.Success(MapMessageItem(existingMessage))
                    : ClientMessengerResult<ClientMessengerMessageItem>.Failure(ClientMessengerError.IdempotencyConflict);
            }
        }

        var now = DateTimeOffset.UtcNow;
        var message = new ClientMessengerMessage
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            AccountId = account.Id,
            Platform = MessengerPlatform.Telegram,
            Direction = ClientMessengerMessageDirection.Outbound,
            Status = ClientMessengerMessageStatus.Queued,
            Text = normalizedText,
            CreatedByUserId = currentUser.Id,
            TelegramUserIdHash = account.PlatformUserIdHash,
            IdempotencyKey = normalizedIdempotencyKey,
            IdempotencyPayloadHash = normalizedIdempotencyKey is null ? null : payloadHash,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.ClientMessengerMessages.Add(message);
        await dbContext.SaveChangesAsync(cancellationToken);

        message.Status = ClientMessengerMessageStatus.Sending;
        message.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        ClientTelegramSendMessageResult sendResult;
        try
        {
            sendResult = telegramTransport.IsConfigured
                ? await telegramTransport.SendTextMessageAsync(account.PlatformUserId, normalizedText, cancellationToken)
                : new ClientTelegramSendMessageResult(false, ErrorMessage: "Клиентский Telegram-бот не настроен.");
        }
        catch (HttpRequestException exception)
        {
            sendResult = new ClientTelegramSendMessageResult(false, ErrorMessage: exception.Message);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            sendResult = new ClientTelegramSendMessageResult(false, ErrorMessage: "Telegram не ответил вовремя.");
        }

        var completedAt = DateTimeOffset.UtcNow;
        if (sendResult.Succeeded)
        {
            message.Status = ClientMessengerMessageStatus.SentToTelegram;
            message.TelegramMessageId = sendResult.MessageId;
            message.TelegramChatId = sendResult.ChatId ?? account.PlatformUserId;
            message.SentAt = completedAt;
            message.FailureReason = null;
            message.FailedAt = null;
        }
        else
        {
            message.Status = ClientMessengerMessageStatus.Failed;
            message.FailureReason = NormalizeFailureReason(sendResult.ErrorMessage);
            message.FailedAt = completedAt;
        }

        message.UpdatedAt = completedAt;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(new AuditLogEntry(
            currentUser.Id,
            ClientMessengerAuditConstants.OutboundMessageSentAction,
            ClientMessengerAuditConstants.EntityType,
            clientId.ToString(),
            $"Пользователь '{currentUser.Login}' отправил сообщение клиенту через Telegram.",
            Source: "Web",
            MessengerPlatform: ClientMessengerAuditConstants.TelegramPlatform,
            MessengerPlatformUserIdHash: account.PlatformUserIdHash), cancellationToken);

        var mappedMessage = await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .Where(candidate => candidate.Id == message.Id)
            .Include(candidate => candidate.CreatedByUser)
            .Include(candidate => candidate.Account)
            .SingleAsync(cancellationToken);

        return ClientMessengerResult<ClientMessengerMessageItem>.Success(MapMessageItem(mappedMessage));
    }

    public async Task<ClientMessengerResult<ClientMessengerReadStateInfo>> MarkTelegramReadAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken = default)
    {
        if (!CanRead(currentUser))
        {
            return ClientMessengerResult<ClientMessengerReadStateInfo>.Failure(ClientMessengerError.Forbidden);
        }

        if (!await ClientExistsAsync(clientId, cancellationToken))
        {
            return ClientMessengerResult<ClientMessengerReadStateInfo>.Failure(ClientMessengerError.NotFound);
        }

        var now = DateTimeOffset.UtcNow;
        var readState = await dbContext.ClientMessengerReadStates
            .SingleOrDefaultAsync(
                state =>
                    state.ClientId == clientId &&
                    state.Platform == MessengerPlatform.Telegram &&
                    state.UserId == currentUser.Id,
                cancellationToken);

        if (readState is null)
        {
            readState = new ClientMessengerReadState
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                Platform = MessengerPlatform.Telegram,
                UserId = currentUser.Id,
                LastReadAt = now,
                UpdatedAt = now
            };
            dbContext.ClientMessengerReadStates.Add(readState);
        }
        else
        {
            readState.LastReadAt = now;
            readState.UpdatedAt = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(new AuditLogEntry(
            currentUser.Id,
            ClientMessengerAuditConstants.ConversationViewedAction,
            ClientMessengerAuditConstants.EntityType,
            clientId.ToString(),
            $"Пользователь '{currentUser.Login}' открыл переписку клиента в Telegram.",
            Source: "Web",
            MessengerPlatform: ClientMessengerAuditConstants.TelegramPlatform), cancellationToken);

        var unreadCount = await CountUnreadAsync(clientId, currentUser.Id, cancellationToken);
        return ClientMessengerResult<ClientMessengerReadStateInfo>.Success(new ClientMessengerReadStateInfo(
            MessengerPlatform.Telegram.ToString(),
            readState.LastReadAt,
            unreadCount));
    }

    public async Task<ClientTelegramUpdateHandleResult> HandleTelegramUpdateAsync(
        ClientTelegramIncomingUpdate update,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(update.Text) ||
            string.IsNullOrWhiteSpace(update.UserId))
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.Ignored);
        }

        if (await dbContext.ClientMessengerMessages.AnyAsync(
                message => message.Platform == MessengerPlatform.Telegram && message.TelegramUpdateId == update.UpdateId,
                cancellationToken))
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.Duplicate);
        }

        var text = update.Text.Trim();
        var startToken = ParseStartToken(text);
        if (startToken is not null)
        {
            return await HandleStartTokenAsync(update, startToken, cancellationToken);
        }

        var platformUserId = update.UserId.Trim();
        var account = await dbContext.ClientMessengerAccounts
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Platform == MessengerPlatform.Telegram &&
                    candidate.PlatformUserId == platformUserId &&
                    candidate.UnlinkedAt == null,
                cancellationToken);
        if (account is null)
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.UnknownAccount);
        }

        if (update.MessageId.HasValue &&
            !string.IsNullOrWhiteSpace(update.ChatId) &&
            await dbContext.ClientMessengerMessages.AnyAsync(
                message =>
                    message.Platform == MessengerPlatform.Telegram &&
                    message.TelegramChatId == update.ChatId &&
                    message.TelegramMessageId == update.MessageId,
                cancellationToken))
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.Duplicate, account.ClientId);
        }

        var now = DateTimeOffset.UtcNow;
        account.Username = NormalizeOptional(update.Username);
        account.DisplayName = BuildDisplayName(update.FirstName, update.LastName, update.Username);
        account.UpdatedAt = now;

        var message = new ClientMessengerMessage
        {
            Id = Guid.NewGuid(),
            ClientId = account.ClientId,
            AccountId = account.Id,
            Platform = MessengerPlatform.Telegram,
            Direction = ClientMessengerMessageDirection.Inbound,
            Status = ClientMessengerMessageStatus.Received,
            Text = text.Length > ClientMessengerMessage.TextMaxLength
                ? text[..ClientMessengerMessage.TextMaxLength]
                : text,
            TelegramUpdateId = update.UpdateId,
            TelegramMessageId = update.MessageId,
            TelegramChatId = NormalizeOptional(update.ChatId),
            TelegramUserIdHash = account.PlatformUserIdHash,
            CreatedAt = update.SentAt ?? now,
            UpdatedAt = now
        };

        dbContext.ClientMessengerMessages.Add(message);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ClientTelegramUpdateHandleResult(
            ClientTelegramUpdateHandleStatus.MessageReceived,
            account.ClientId,
            message.Id);
    }

    private async Task<ClientTelegramUpdateHandleResult> HandleStartTokenAsync(
        ClientTelegramIncomingUpdate update,
        string rawToken,
        CancellationToken cancellationToken)
    {
        var tokenHash = MessengerHashing.ComputeSha256(rawToken);
        var token = await dbContext.ClientMessengerLinkTokens
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Platform == MessengerPlatform.Telegram &&
                    candidate.TokenHash == tokenHash,
                cancellationToken);

        if (token is null || token.UsedAt is not null)
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.InvalidToken);
        }

        var now = DateTimeOffset.UtcNow;
        if (token.ExpiresAt <= now)
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.ExpiredToken, token.ClientId);
        }

        var platformUserId = update.UserId!.Trim();
        var platformUserIdHash = MessengerHashing.ComputeSha256(platformUserId);

        var existingUserAccount = await dbContext.ClientMessengerAccounts
            .SingleOrDefaultAsync(
                account =>
                    account.Platform == MessengerPlatform.Telegram &&
                    account.PlatformUserId == platformUserId &&
                    account.UnlinkedAt == null,
                cancellationToken);
        if (existingUserAccount is not null && existingUserAccount.ClientId != token.ClientId)
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.AccountConflict, token.ClientId);
        }

        var existingClientAccount = await GetActiveAccountAsync(token.ClientId, cancellationToken);
        if (existingClientAccount is not null && existingClientAccount.PlatformUserId != platformUserId)
        {
            return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.AccountConflict, token.ClientId);
        }

        var account = existingUserAccount ?? existingClientAccount;
        if (account is null)
        {
            account = new ClientMessengerAccount
            {
                Id = Guid.NewGuid(),
                ClientId = token.ClientId,
                Platform = MessengerPlatform.Telegram,
                PlatformUserId = platformUserId,
                PlatformUserIdHash = platformUserIdHash,
                LinkedAt = now,
                CreatedAt = now
            };
            dbContext.ClientMessengerAccounts.Add(account);
        }

        account.Username = NormalizeOptional(update.Username);
        account.DisplayName = BuildDisplayName(update.FirstName, update.LastName, update.Username);
        account.UpdatedAt = now;
        token.UsedAt = now;
        token.UsedByPlatformUserIdHash = platformUserIdHash;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(new AuditLogEntry(
            token.CreatedByUserId,
            ClientMessengerAuditConstants.AccountLinkedAction,
            ClientMessengerAuditConstants.EntityType,
            token.ClientId.ToString(),
            "Клиент подключил Telegram к карточке CRM.",
            Source: "Telegram",
            MessengerPlatform: ClientMessengerAuditConstants.TelegramPlatform,
            MessengerPlatformUserIdHash: platformUserIdHash), cancellationToken);

        return new ClientTelegramUpdateHandleResult(ClientTelegramUpdateHandleStatus.AccountLinked, token.ClientId);
    }

    private async Task<ClientMessengerSummary> BuildSummaryAsync(
        Guid clientId,
        User currentUser,
        CancellationToken cancellationToken)
    {
        var activeAccount = await GetActiveAccountAsync(clientId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var pendingToken = activeAccount is null
            ? await dbContext.ClientMessengerLinkTokens
                .AsNoTracking()
                .Where(token =>
                    token.ClientId == clientId &&
                    token.Platform == MessengerPlatform.Telegram &&
                    token.UsedAt == null &&
                    token.ExpiresAt > now)
                .OrderByDescending(token => token.ExpiresAt)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var totalMessageCount = await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .CountAsync(
                message => message.ClientId == clientId && message.Platform == MessengerPlatform.Telegram,
                cancellationToken);
        var latestMessage = await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .Where(message => message.ClientId == clientId && message.Platform == MessengerPlatform.Telegram)
            .OrderByDescending(message => message.CreatedAt)
            .ThenByDescending(message => message.Id)
            .FirstOrDefaultAsync(cancellationToken);
        var unreadCount = await CountUnreadAsync(clientId, currentUser.Id, cancellationToken);

        var connection = activeAccount is not null
            ? new ClientMessengerConnection(
                ClientMessengerConnectionStatus.Connected.ToString(),
                activeAccount.LinkedAt,
                activeAccount.Username,
                activeAccount.DisplayName,
                null)
            : pendingToken is not null
                ? new ClientMessengerConnection(
                    ClientMessengerConnectionStatus.PendingLink.ToString(),
                    null,
                    null,
                    null,
                    pendingToken.ExpiresAt)
                : new ClientMessengerConnection(
                    ClientMessengerConnectionStatus.NotConnected.ToString(),
                    null,
                    null,
                    null,
                    null);

        return new ClientMessengerSummary(
            MessengerPlatform.Telegram.ToString(),
            BuildCapabilities(currentUser),
            connection,
            unreadCount,
            totalMessageCount,
            latestMessage?.CreatedAt,
            latestMessage is null
                ? null
                : new ClientMessengerLatestMessage(
                    latestMessage.Id,
                    latestMessage.Direction.ToString(),
                    latestMessage.Status.ToString(),
                    latestMessage.Text,
                    latestMessage.CreatedAt));
    }

    private async Task<int> CountUnreadAsync(
        Guid clientId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var lastReadAt = await dbContext.ClientMessengerReadStates
            .AsNoTracking()
            .Where(state =>
                state.ClientId == clientId &&
                state.Platform == MessengerPlatform.Telegram &&
                state.UserId == userId)
            .Select(state => (DateTimeOffset?)state.LastReadAt)
            .SingleOrDefaultAsync(cancellationToken);

        return await dbContext.ClientMessengerMessages
            .AsNoTracking()
            .CountAsync(
                message =>
                    message.ClientId == clientId &&
                    message.Platform == MessengerPlatform.Telegram &&
                    message.Direction == ClientMessengerMessageDirection.Inbound &&
                    (!lastReadAt.HasValue || message.CreatedAt > lastReadAt.Value),
                cancellationToken);
    }

    private async Task<string?> ResolveBotUsernameAsync(
        string? configuredBotUsername,
        CancellationToken cancellationToken)
    {
        if (!telegramTransport.IsConfigured)
        {
            return configuredBotUsername;
        }

        try
        {
            var identity = await telegramTransport.GetBotIdentityAsync(cancellationToken);
            var actualBotUsername = ClientTelegramOptions.NormalizeBotUsername(identity?.Username);
            return actualBotUsername ?? configuredBotUsername;
        }
        catch (HttpRequestException)
        {
            return configuredBotUsername;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return configuredBotUsername;
        }
    }

    private async Task<ClientMessengerAccount?> GetActiveAccountAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        return await dbContext.ClientMessengerAccounts
            .SingleOrDefaultAsync(
                account =>
                    account.ClientId == clientId &&
                    account.Platform == MessengerPlatform.Telegram &&
                    account.UnlinkedAt == null,
                cancellationToken);
    }

    private async Task<bool> ClientExistsAsync(Guid clientId, CancellationToken cancellationToken)
    {
        return await dbContext.Clients
            .AsNoTracking()
            .AnyAsync(client => client.Id == clientId, cancellationToken);
    }

    private static ClientMessengerCapabilities BuildCapabilities(User currentUser)
    {
        var canRead = CanRead(currentUser);
        var canReply = CanReply(currentUser);
        var canCreateLink = CanCreateLink(currentUser);
        return new ClientMessengerCapabilities(
            canRead,
            canRead,
            canReply,
            canCreateLink,
            canCreateLink);
    }

    private static bool CanRead(User currentUser)
    {
        return currentUser.Role is UserRole.HeadCoach or UserRole.Administrator;
    }

    private static bool CanReply(User currentUser)
    {
        return currentUser.Role == UserRole.Administrator;
    }

    private static bool CanCreateLink(User currentUser)
    {
        return currentUser.Role is UserRole.HeadCoach or UserRole.Administrator;
    }

    private static Dictionary<string, string[]> ValidatePaging(int? skip, int? take)
    {
        var errors = new Dictionary<string, string[]>();
        if (skip is < 0)
        {
            errors["skip"] = ["Skip cannot be negative."];
        }

        if (take is <= 0 or > MaxMessageTake)
        {
            errors["take"] = [$"Take must be between 1 and {MaxMessageTake}."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateOutboundMessage(string text, string? idempotencyKey)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(text))
        {
            errors["text"] = ["Введите текст сообщения."];
        }
        else if (text.Length > ClientMessengerMessage.TextMaxLength)
        {
            errors["text"] = [$"Сообщение не должно превышать {ClientMessengerMessage.TextMaxLength} символов."];
        }

        if (NormalizeOptional(idempotencyKey) is { Length: > 128 })
        {
            errors["idempotencyKey"] = ["Ключ идемпотентности слишком длинный."];
        }

        return errors;
    }

    private static string? ParseStartToken(string text)
    {
        var parts = text.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
        {
            return null;
        }

        var command = parts[0];
        if (!command.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return string.IsNullOrWhiteSpace(parts[1]) ? null : parts[1].Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string? BuildDisplayName(string? firstName, string? lastName, string? username)
    {
        var parts = new[] { NormalizeOptional(firstName), NormalizeOptional(lastName) }
            .Where(part => part is not null)
            .ToArray();
        if (parts.Length > 0)
        {
            return string.Join(' ', parts);
        }

        var normalizedUsername = NormalizeOptional(username);
        return normalizedUsername is null ? null : $"@{normalizedUsername}";
    }

    private static string? NormalizeFailureReason(string? reason)
    {
        var normalized = NormalizeOptional(reason) ?? "Не удалось отправить сообщение в Telegram.";
        return normalized.Length <= ClientMessengerMessage.FailureReasonMaxLength
            ? normalized
            : normalized[..ClientMessengerMessage.FailureReasonMaxLength];
    }

    private static ClientMessengerMessageItem MapMessageItem(ClientMessengerMessage message)
    {
        return new ClientMessengerMessageItem(
            message.Id,
            message.Direction.ToString(),
            message.Status.ToString(),
            message.Text,
            message.CreatedAt,
            message.UpdatedAt,
            message.SentAt,
            message.FailedAt,
            message.FailureReason,
            message.CreatedByUser?.FullName,
            message.Account?.Username,
            message.Account?.DisplayName);
    }
}
