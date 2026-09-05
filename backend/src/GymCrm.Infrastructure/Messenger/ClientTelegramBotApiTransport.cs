using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Messenger;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.Messenger;

internal sealed class ClientTelegramBotApiTransport(
    HttpClient httpClient,
    IOptionsMonitor<ClientTelegramOptions> options) : IClientTelegramTransport
{
    public bool IsConfigured => options.CurrentValue.HasBotToken;

    public async Task<ClientTelegramBotIdentity?> GetBotIdentityAsync(
        CancellationToken cancellationToken = default)
    {
        var token = GetBotToken();
        if (token is null)
        {
            return null;
        }

        using var response = await httpClient.GetAsync($"/bot{token}/getMe", cancellationToken);
        using var payloadStream = await response.Content.ReadAsStreamAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        try
        {
            using var document = await JsonDocument.ParseAsync(payloadStream, cancellationToken: cancellationToken);
            if (!document.RootElement.TryGetProperty("ok", out var okElement) ||
                !okElement.GetBoolean() ||
                !document.RootElement.TryGetProperty("result", out var resultElement))
            {
                return null;
            }

            var username = ClientTelegramOptions.NormalizeBotUsername(ReadString(resultElement, "username"));
            return username is null ? null : new ClientTelegramBotIdentity(username);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<ClientTelegramIncomingUpdate>> GetUpdatesAsync(
        long? offset,
        int limit,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var token = GetBotToken();
        if (token is null)
        {
            return [];
        }

        var query = new List<string>
        {
            $"limit={Math.Clamp(limit, 1, 100)}",
            $"timeout={Math.Clamp((int)timeout.TotalSeconds, 0, 50)}",
            "allowed_updates=%5B%22message%22%5D"
        };

        if (offset.HasValue)
        {
            query.Add($"offset={offset.Value}");
        }

        using var response = await httpClient.GetAsync(
            $"/bot{token}/getUpdates?{string.Join('&', query)}",
            cancellationToken);
        using var payloadStream = await response.Content.ReadAsStreamAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        using var document = await JsonDocument.ParseAsync(payloadStream, cancellationToken: cancellationToken);
        if (!document.RootElement.TryGetProperty("ok", out var okElement) || !okElement.GetBoolean())
        {
            return [];
        }

        if (!document.RootElement.TryGetProperty("result", out var resultElement) ||
            resultElement.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var updates = new List<ClientTelegramIncomingUpdate>();
        foreach (var updateElement in resultElement.EnumerateArray())
        {
            var updateId = ReadInt64(updateElement, "update_id");
            if (!updateId.HasValue ||
                !updateElement.TryGetProperty("message", out var messageElement))
            {
                continue;
            }

            var messageId = ReadInt64(messageElement, "message_id");
            var text = ReadString(messageElement, "text");
            DateTimeOffset? sentAt = null;
            var unixDate = ReadInt64(messageElement, "date");
            if (unixDate.HasValue)
            {
                sentAt = DateTimeOffset.FromUnixTimeSeconds(unixDate.Value);
            }

            string? chatId = null;
            if (messageElement.TryGetProperty("chat", out var chatElement))
            {
                chatId = ReadFlexibleString(chatElement, "id");
            }

            string? userId = null;
            string? username = null;
            string? firstName = null;
            string? lastName = null;
            if (messageElement.TryGetProperty("from", out var fromElement))
            {
                userId = ReadFlexibleString(fromElement, "id");
                username = ReadString(fromElement, "username");
                firstName = ReadString(fromElement, "first_name");
                lastName = ReadString(fromElement, "last_name");
            }

            updates.Add(new ClientTelegramIncomingUpdate(
                updateId.Value,
                messageId,
                chatId,
                userId,
                username,
                firstName,
                lastName,
                text,
                sentAt));
        }

        return updates;
    }

    public async Task<ClientTelegramSendMessageResult> SendTextMessageAsync(
        string telegramUserId,
        string text,
        CancellationToken cancellationToken = default)
    {
        var token = GetBotToken();
        if (token is null)
        {
            return new ClientTelegramSendMessageResult(false, ErrorMessage: global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.ClientTelegramBotApiTransportLine157Ab3a6efa);
        }

        using var response = await httpClient.PostAsJsonAsync(
            $"/bot{token}/sendMessage",
            new
            {
                chat_id = telegramUserId,
                text,
                disable_web_page_preview = true
            },
            cancellationToken);
        using var payloadStream = await response.Content.ReadAsStreamAsync(cancellationToken);

        JsonDocument? document = null;
        try
        {
            document = await JsonDocument.ParseAsync(payloadStream, cancellationToken: cancellationToken);
            if (response.IsSuccessStatusCode &&
                document.RootElement.TryGetProperty("ok", out var okElement) &&
                okElement.GetBoolean() &&
                document.RootElement.TryGetProperty("result", out var resultElement))
            {
                var messageId = ReadInt64(resultElement, "message_id");
                string? chatId = null;
                if (resultElement.TryGetProperty("chat", out var chatElement))
                {
                    chatId = ReadFlexibleString(chatElement, "id");
                }

                return new ClientTelegramSendMessageResult(true, messageId, chatId);
            }

            var description = ReadString(document.RootElement, "description");
            return new ClientTelegramSendMessageResult(false, ErrorMessage: description ?? global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.ClientTelegramBotApiTransportLine1917e219538);
        }
        catch (JsonException)
        {
            return new ClientTelegramSendMessageResult(false, ErrorMessage: global::GymCrm.Infrastructure.UserFacingText.InfrastructureOperationalText.ClientTelegramBotApiTransportLine195D094d7d0);
        }
        finally
        {
            document?.Dispose();
        }
    }

    private string? GetBotToken()
    {
        var token = options.CurrentValue.BotToken?.Trim();
        return string.IsNullOrWhiteSpace(token) ? null : token;
    }

    private static string? ReadString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var property) &&
               property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static long? ReadInt64(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var property) &&
               property.TryGetInt64(out var value)
            ? value
            : null;
    }

    private static string? ReadFlexibleString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetInt64(out var value) => value.ToString(CultureInfo.InvariantCulture),
            JsonValueKind.String => property.GetString(),
            _ => null
        };
    }
}
