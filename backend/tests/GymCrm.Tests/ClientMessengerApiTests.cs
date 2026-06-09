using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GymCrm.Application.Messenger;
using GymCrm.Application.Security;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Messenger;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace GymCrm.Tests;

public class ClientMessengerApiTests
{
    [Theory]
    [InlineData("gym_client_bot", "gym_client_bot")]
    [InlineData("@gym_client_bot", "gym_client_bot")]
    [InlineData("https://t.me/gym_client_bot", "gym_client_bot")]
    [InlineData("t.me/gym_client_bot?start=legacy-token", "gym_client_bot")]
    [InlineData("telegram.me/gym_client_bot", "gym_client_bot")]
    [InlineData("k4pro_admin", null)]
    [InlineData("gym-client-bot", null)]
    [InlineData("bot", null)]
    [InlineData(null, null)]
    public void Client_telegram_options_normalize_only_valid_bot_usernames(
        string? value,
        string? expected)
    {
        Assert.Equal(expected, ClientTelegramOptions.NormalizeBotUsername(value));
    }

    [Fact]
    public async Task Client_telegram_transport_uses_https_paths_when_token_contains_colon()
    {
        var handler = new RecordingTelegramHandler();
        using var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.telegram.org/")
        };
        var transport = new ClientTelegramBotApiTransport(
            httpClient,
            new OptionsMonitorStub<ClientTelegramOptions>(new ClientTelegramOptions
            {
                BotToken = "123456:ABC"
            }));

        var identity = await transport.GetBotIdentityAsync();
        var updates = await transport.GetUpdatesAsync(
            10,
            50,
            TimeSpan.FromSeconds(20));
        var sendResult = await transport.SendTextMessageAsync("777001", "Здравствуйте!");

        Assert.Equal("actual_client_bot", identity?.Username);
        Assert.Empty(updates);
        Assert.True(sendResult.Succeeded);
        Assert.Collection(
            handler.RequestUris,
            uri =>
            {
                Assert.Equal("https", uri.Scheme);
                Assert.Equal("api.telegram.org", uri.Host);
                Assert.Equal("/bot123456:ABC/getMe", uri.AbsolutePath);
            },
            uri =>
            {
                Assert.Equal("https", uri.Scheme);
                Assert.Equal("api.telegram.org", uri.Host);
                Assert.Equal("/bot123456:ABC/getUpdates", uri.AbsolutePath);
                Assert.Contains("offset=10", uri.Query);
            },
            uri =>
            {
                Assert.Equal("https", uri.Scheme);
                Assert.Equal("api.telegram.org", uri.Host);
                Assert.Equal("/bot123456:ABC/sendMessage", uri.AbsolutePath);
            });
    }

    [Fact]
    public async Task HeadCoach_and_administrator_can_create_link_and_reply()
    {
        await using var factory = new ClientMessengerAppFactory();
        var seeded = await SeedAsync(factory);

        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using (var summaryResponse = await adminClient.GetAsync($"/clients/{seeded.ClientId}/messenger/telegram"))
        {
            Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
            var summary = await ReadJsonElementAsync(summaryResponse);
            Assert.Equal("NotConnected", summary.GetProperty("connection").GetProperty("status").GetString());
            Assert.True(summary.GetProperty("capabilities").GetProperty("canReply").GetBoolean());
            Assert.True(summary.GetProperty("capabilities").GetProperty("canCreateLink").GetBoolean());
        }

        using (var linkResponse = await PostWithoutBodyAsync(
                   adminClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
                   adminSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);
            var linkPayload = await ReadJsonElementAsync(linkResponse);
            Assert.Contains("https://t.me/gym_client_bot?start=", linkPayload.GetProperty("deepLinkUrl").GetString());
            Assert.StartsWith("<svg", linkPayload.GetProperty("qrCodeSvg").GetString());
        }

        using var headCoachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var headCoachSession = await LoginAsync(headCoachClient, seeded.HeadCoachLogin, seeded.SharedPassword);

        using (var headCoachSummaryResponse = await headCoachClient.GetAsync($"/clients/{seeded.ClientId}/messenger/telegram"))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachSummaryResponse.StatusCode);
            var summary = await ReadJsonElementAsync(headCoachSummaryResponse);
            Assert.True(summary.GetProperty("capabilities").GetProperty("canRead").GetBoolean());
            Assert.True(summary.GetProperty("capabilities").GetProperty("canReply").GetBoolean());
            Assert.True(summary.GetProperty("capabilities").GetProperty("canCreateLink").GetBoolean());
        }

        string headCoachLinkToken;
        using (var headCoachLinkResponse = await PostWithoutBodyAsync(
                   headCoachClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
                   headCoachSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachLinkResponse.StatusCode);
            var linkPayload = await ReadJsonElementAsync(headCoachLinkResponse);
            var deepLinkUrl = linkPayload.GetProperty("deepLinkUrl").GetString()
                ?? throw new InvalidOperationException("Deep link URL is missing.");
            Assert.Contains("https://t.me/gym_client_bot?start=", deepLinkUrl);
            headCoachLinkToken = deepLinkUrl.Split("start=", 2)[1];
        }

        using (var scope = factory.Services.CreateScope())
        {
            var messengerService = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
            var linked = await messengerService.HandleTelegramUpdateAsync(new ClientTelegramIncomingUpdate(
                100,
                10,
                "777001",
                "777001",
                "client_telegram",
                "Telegram",
                "Client",
                $"/start {headCoachLinkToken}",
                DateTimeOffset.UtcNow));
            Assert.Equal(ClientTelegramUpdateHandleStatus.AccountLinked, linked.Status);
        }

        using (var headCoachSendResponse = await PostJsonAsync(
                   headCoachClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/messages",
                   new { Text = "Напоминание" },
                   headCoachSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, headCoachSendResponse.StatusCode);
            var payload = await ReadJsonElementAsync(headCoachSendResponse);
            Assert.Equal("SentToTelegram", payload.GetProperty("status").GetString());
        }

        using var coachClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        _ = await LoginAsync(coachClient, seeded.CoachLogin, seeded.SharedPassword);

        using var coachSummaryResponse = await coachClient.GetAsync($"/clients/{seeded.ClientId}/messenger/telegram");
        Assert.Equal(HttpStatusCode.Forbidden, coachSummaryResponse.StatusCode);
    }

    [Fact]
    public async Task Telegram_link_uses_username_reported_by_bot_token_when_username_is_not_configured()
    {
        await using var factory = new ClientMessengerAppFactory(
            configuredBotUsername: string.Empty,
            telegramBotUsername: "actual_client_bot");
        var seeded = await SeedAsync(factory);

        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using var linkResponse = await PostWithoutBodyAsync(
            adminClient,
            $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);

        var linkPayload = await ReadJsonElementAsync(linkResponse);
        var deepLinkUrl = linkPayload.GetProperty("deepLinkUrl").GetString();
        Assert.Contains("https://t.me/actual_client_bot?start=", deepLinkUrl);
        Assert.Equal(1, factory.TelegramTransport.GetIdentityCount);
    }

    [Fact]
    public async Task Telegram_link_uses_configured_username_without_bot_api_lookup()
    {
        await using var factory = new ClientMessengerAppFactory(
            configuredBotUsername: "configured_client_bot",
            telegramBotUsername: "actual_client_bot");
        var seeded = await SeedAsync(factory);

        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using var linkResponse = await PostWithoutBodyAsync(
            adminClient,
            $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);

        var linkPayload = await ReadJsonElementAsync(linkResponse);
        var deepLinkUrl = linkPayload.GetProperty("deepLinkUrl").GetString();
        Assert.Contains("https://t.me/configured_client_bot?start=", deepLinkUrl);
        Assert.DoesNotContain("actual_client_bot", deepLinkUrl);
        Assert.Equal(0, factory.TelegramTransport.GetIdentityCount);
    }

    [Fact]
    public async Task Telegram_link_falls_back_to_configured_username_when_bot_api_is_unavailable()
    {
        await using var factory = new ClientMessengerAppFactory(
            configuredBotUsername: "configured_client_bot",
            configuredBotToken: string.Empty,
            telegramBotUsername: null);
        var seeded = await SeedAsync(factory);

        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using var linkResponse = await PostWithoutBodyAsync(
            adminClient,
            $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);

        var linkPayload = await ReadJsonElementAsync(linkResponse);
        Assert.Contains(
            "https://t.me/configured_client_bot?start=",
            linkPayload.GetProperty("deepLinkUrl").GetString());
    }

    [Fact]
    public async Task Telegram_link_inbound_and_outbound_messages_are_idempotent()
    {
        await using var factory = new ClientMessengerAppFactory();
        var seeded = await SeedAsync(factory);
        using var adminClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
        var adminSession = await LoginAsync(adminClient, seeded.AdministratorLogin, seeded.SharedPassword);

        using var linkResponse = await PostWithoutBodyAsync(
            adminClient,
            $"/clients/{seeded.ClientId}/messenger/telegram/link-token",
            adminSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);
        var linkPayload = await ReadJsonElementAsync(linkResponse);
        var linkToken = linkPayload.GetProperty("deepLinkUrl").GetString()!.Split("start=", 2)[1];

        using (var scope = factory.Services.CreateScope())
        {
            var messengerService = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
            var linked = await messengerService.HandleTelegramUpdateAsync(new ClientTelegramIncomingUpdate(
                100,
                10,
                "777001",
                "777001",
                "client_telegram",
                "Telegram",
                "Client",
                $"/start {linkToken}",
                DateTimeOffset.UtcNow));
            Assert.Equal(ClientTelegramUpdateHandleStatus.AccountLinked, linked.Status);

            var reusedToken = await messengerService.HandleTelegramUpdateAsync(new ClientTelegramIncomingUpdate(
                101,
                11,
                "777001",
                "777001",
                "client_telegram",
                "Telegram",
                "Client",
                $"/start {linkToken}",
                DateTimeOffset.UtcNow));
            Assert.Equal(ClientTelegramUpdateHandleStatus.InvalidToken, reusedToken.Status);
        }

        using (var connectedSummaryResponse = await adminClient.GetAsync($"/clients/{seeded.ClientId}/messenger/telegram"))
        {
            Assert.Equal(HttpStatusCode.OK, connectedSummaryResponse.StatusCode);
            var summary = await ReadJsonElementAsync(connectedSummaryResponse);
            Assert.Equal("Connected", summary.GetProperty("connection").GetProperty("status").GetString());
        }

        using (var sendResponse = await PostJsonAsync(
                   adminClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/messages",
                   new { Text = "Здравствуйте!", IdempotencyKey = "reply-1" },
                   adminSession.CsrfToken,
                   "reply-1"))
        {
            Assert.Equal(HttpStatusCode.OK, sendResponse.StatusCode);
            var payload = await ReadJsonElementAsync(sendResponse);
            Assert.Equal("SentToTelegram", payload.GetProperty("status").GetString());
        }

        using (var replayResponse = await PostJsonAsync(
                   adminClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/messages",
                   new { Text = "Здравствуйте!", IdempotencyKey = "reply-1" },
                   adminSession.CsrfToken,
                   "reply-1"))
        {
            Assert.Equal(HttpStatusCode.OK, replayResponse.StatusCode);
        }

        Assert.Equal(1, factory.TelegramTransport.SendCount);

        using (var scope = factory.Services.CreateScope())
        {
            var messengerService = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
            var received = await messengerService.HandleTelegramUpdateAsync(new ClientTelegramIncomingUpdate(
                200,
                20,
                "777001",
                "777001",
                "client_telegram",
                "Telegram",
                "Client",
                "Спасибо, приду завтра.",
                DateTimeOffset.UtcNow));
            var duplicate = await messengerService.HandleTelegramUpdateAsync(new ClientTelegramIncomingUpdate(
                200,
                20,
                "777001",
                "777001",
                "client_telegram",
                "Telegram",
                "Client",
                "Спасибо, приду завтра.",
                DateTimeOffset.UtcNow));

            Assert.Equal(ClientTelegramUpdateHandleStatus.MessageReceived, received.Status);
            Assert.Equal(ClientTelegramUpdateHandleStatus.Duplicate, duplicate.Status);

            var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
            var inboundCount = await dbContext.ClientMessengerMessages.CountAsync(
                message =>
                    message.ClientId == seeded.ClientId &&
                    message.Direction == ClientMessengerMessageDirection.Inbound);
            Assert.Equal(1, inboundCount);
        }

        using (var readResponse = await PostWithoutBodyAsync(
                   adminClient,
                   $"/clients/{seeded.ClientId}/messenger/telegram/read",
                   adminSession.CsrfToken))
        {
            Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);
            var payload = await ReadJsonElementAsync(readResponse);
            Assert.Equal(0, payload.GetProperty("unreadCount").GetInt32());
        }
    }

    private static async Task<SeededMessengerData> SeedAsync(ClientMessengerAppFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var passwordHashService = scope.ServiceProvider.GetRequiredService<IPasswordHashService>();
        var now = DateTimeOffset.UtcNow;
        const string password = "messenger-tests-password";

        var headCoach = CreateUser("headcoach-messenger", "Главный тренер Messenger", UserRole.HeadCoach, password, now, passwordHashService);
        var administrator = CreateUser("administrator-messenger", "Администратор Messenger", UserRole.Administrator, password, now, passwordHashService);
        var coach = CreateUser("coach-messenger", "Тренер Messenger", UserRole.Coach, password, now, passwordHashService);
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Messenger Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            FirstName = "Messenger",
            LastName = "Client",
            Phone = "+79990000001",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.AddRange(headCoach, administrator, coach);
        dbContext.Branches.Add(branch);
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync();

        return new SeededMessengerData(
            headCoach.Login,
            administrator.Login,
            coach.Login,
            password,
            client.Id);
    }

    private static User CreateUser(
        string login,
        string fullName,
        UserRole role,
        string password,
        DateTimeOffset now,
        IPasswordHashService passwordHashService)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Login = login,
            Role = role,
            MustChangePassword = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHashService.HashPassword(user, password);
        return user;
    }

    private static async Task<SessionPayload> LoginAsync(HttpClient client, string login, string password)
    {
        using var sessionResponse = await client.GetAsync("/auth/session");
        var initialSession = await ReadJsonAsync<SessionPayload>(sessionResponse);

        using var loginResponse = await PostJsonAsync(
            client,
            "/auth/login",
            new LoginRequest(login, password),
            initialSession.CsrfToken);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return await ReadJsonAsync<SessionPayload>(loginResponse);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync<TPayload>(
        HttpClient client,
        string path,
        TPayload payload,
        string csrfToken,
        string? idempotencyKey = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostWithoutBodyAsync(
        HttpClient client,
        string path,
        string csrfToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonElementAsync(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        var payload = await response.Content.ReadFromJsonAsync<T>();
        return payload ?? throw new InvalidOperationException("Response JSON payload was empty.");
    }

    private sealed record LoginRequest(string Login, string Password);

    private sealed record SessionPayload(
        bool IsAuthenticated,
        string CsrfToken,
        UserPayload? User,
        bool BootstrapMode);

    private sealed record UserPayload(
        string Id,
        string FullName,
        string Login,
        string Role,
        bool MustChangePassword,
        bool IsActive,
        string LandingScreen);

    private sealed record SeededMessengerData(
        string HeadCoachLogin,
        string AdministratorLogin,
        string CoachLogin,
        string SharedPassword,
        Guid ClientId);

    public sealed class FakeClientTelegramTransport : IClientTelegramTransport
    {
        public bool IsConfigured { get; set; } = true;
        public string? BotUsername { get; set; } = "gym_client_bot";
        public int GetIdentityCount { get; private set; }
        public int SendCount { get; private set; }

        public Task<ClientTelegramBotIdentity?> GetBotIdentityAsync(
            CancellationToken cancellationToken = default)
        {
            GetIdentityCount++;
            return Task.FromResult(
                IsConfigured && BotUsername is not null
                    ? new ClientTelegramBotIdentity(BotUsername)
                    : null);
        }

        public Task<IReadOnlyList<ClientTelegramIncomingUpdate>> GetUpdatesAsync(
            long? offset,
            int limit,
            TimeSpan timeout,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<ClientTelegramIncomingUpdate>>([]);
        }

        public Task<ClientTelegramSendMessageResult> SendTextMessageAsync(
            string telegramUserId,
            string text,
            CancellationToken cancellationToken = default)
        {
            SendCount++;
            return Task.FromResult(new ClientTelegramSendMessageResult(
                true,
                9000 + SendCount,
                telegramUserId));
        }
    }

    private sealed class ClientMessengerAppFactory : WebApplicationFactory<Program>
    {
        private readonly string configuredBotUsername;
        private readonly string configuredBotToken;

        public ClientMessengerAppFactory(
            string configuredBotUsername = "gym_client_bot",
            string configuredBotToken = "test-client-telegram-token",
            string? telegramBotUsername = "gym_client_bot")
        {
            this.configuredBotUsername = configuredBotUsername;
            this.configuredBotToken = configuredBotToken;
            TelegramTransport = new FakeClientTelegramTransport
            {
                IsConfigured = !string.IsNullOrWhiteSpace(configuredBotToken),
                BotUsername = telegramBotUsername
            };
        }

        public FakeClientTelegramTransport TelegramTransport { get; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureAppConfiguration((_, configurationBuilder) =>
            {
                configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Postgres"] = "Host=localhost;Port=5432;Database=gym_crm;Username=gym_crm;Password=gym_crm",
                    ["Persistence:ApplyMigrationsOnStartup"] = "false",
                    ["ClientTelegram:Enabled"] = "false",
                    ["ClientTelegram:BotUsername"] = configuredBotUsername,
                    ["ClientTelegram:BotToken"] = configuredBotToken,
                    ["BootstrapUser:Login"] = "bootstrap-messenger"
                });
            });

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<GymCrmDbContext>>();
                services.RemoveAll<GymCrmDbContext>();
                services.RemoveAll<IClientTelegramTransport>();

                var databaseName = $"gym-crm-client-messenger-tests-{Guid.NewGuid():N}";
                var entityFrameworkProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<GymCrmDbContext>(options =>
                    options
                        .UseInMemoryDatabase(databaseName)
                        .UseInternalServiceProvider(entityFrameworkProvider));
                services.AddSingleton<IClientTelegramTransport>(TelegramTransport);
            });
        }
    }

    private sealed class RecordingTelegramHandler : HttpMessageHandler
    {
        public List<Uri> RequestUris { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var requestUri = request.RequestUri ?? throw new InvalidOperationException("Request URI is missing.");
            RequestUris.Add(requestUri);

            object payload = requestUri.AbsolutePath switch
            {
                var path when path.EndsWith("/getMe", StringComparison.Ordinal) => new
                {
                    ok = true,
                    result = new
                    {
                        username = "actual_client_bot"
                    }
                },
                var path when path.EndsWith("/getUpdates", StringComparison.Ordinal) => new
                {
                    ok = true,
                    result = Array.Empty<object>()
                },
                var path when path.EndsWith("/sendMessage", StringComparison.Ordinal) => new
                {
                    ok = true,
                    result = new
                    {
                        message_id = 9001,
                        chat = new
                        {
                            id = 777001
                        }
                    }
                },
                _ => new
                {
                    ok = false,
                    description = "Unexpected Telegram API path."
                }
            };

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(payload)
            });
        }
    }

    private sealed class OptionsMonitorStub<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue => value;

        public T Get(string? name) => value;

        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }
}
