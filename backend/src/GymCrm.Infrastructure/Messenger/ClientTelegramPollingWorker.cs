using GymCrm.Application.Messenger;
using GymCrm.Domain.Messenger;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.Messenger;

internal sealed class ClientTelegramPollingWorker(
    IServiceScopeFactory scopeFactory,
    IClientTelegramTransport telegramTransport,
    IOptionsMonitor<ClientTelegramOptions> options,
    ILogger<ClientTelegramPollingWorker> logger) : BackgroundService
{
    private const string PollStateName = "client-telegram";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.CurrentValue.Enabled)
        {
            return;
        }

        if (!telegramTransport.IsConfigured)
        {
            logger.LogWarning("Client Telegram polling is enabled, but bot token is not configured.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var currentOptions = options.CurrentValue;
            try
            {
                await PollOnceAsync(currentOptions, stoppingToken);
                await Task.Delay(
                    TimeSpan.FromSeconds(Math.Clamp(currentOptions.PollingIntervalSeconds, 1, 60)),
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Client Telegram polling iteration failed.");
                await Task.Delay(
                    TimeSpan.FromSeconds(Math.Clamp(currentOptions.BackoffSeconds, 1, 300)),
                    stoppingToken);
            }
        }
    }

    private async Task PollOnceAsync(ClientTelegramOptions currentOptions, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GymCrmDbContext>();
        var messengerService = scope.ServiceProvider.GetRequiredService<IClientMessengerService>();
        var state = await dbContext.ClientTelegramPollStates
            .SingleOrDefaultAsync(candidate => candidate.BotName == PollStateName, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (state is null)
        {
            state = new ClientTelegramPollState
            {
                Id = Guid.NewGuid(),
                BotName = PollStateName,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.ClientTelegramPollStates.Add(state);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var updates = await telegramTransport.GetUpdatesAsync(
            state.NextUpdateOffset,
            Math.Clamp(currentOptions.MaxUpdatesPerPoll, 1, 100),
            TimeSpan.FromSeconds(Math.Clamp(currentOptions.PollingTimeoutSeconds, 0, 50)),
            cancellationToken);

        foreach (var update in updates.OrderBy(update => update.UpdateId))
        {
            await messengerService.HandleTelegramUpdateAsync(update, cancellationToken);
            state.NextUpdateOffset = update.UpdateId + 1;
            state.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
