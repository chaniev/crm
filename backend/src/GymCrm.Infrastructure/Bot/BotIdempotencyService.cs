using System.Text.Json;
using GymCrm.Application.Bot;
using GymCrm.Domain.Bot;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.Bot;

internal sealed class BotIdempotencyService(
    GymCrmDbContext dbContext,
    IOptions<BotIdempotencyOptions> options)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<Reservation<TResponse>> ReserveAsync<TResponse>(
        BotIdentity identity,
        string actionType,
        string idempotencyKey,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var platformUserIdHash = BotHashing.ComputeSha256(identity.PlatformUserId);
        var payloadHash = BotHashing.ComputeSha256(payloadJson);
        var normalizedPlatform = identity.Platform.Trim();
        var normalizedIdempotencyKey = idempotencyKey.Trim();

        var existingRecord = await dbContext.BotIdempotencyRecords
            .SingleOrDefaultAsync(
                record =>
                    record.Platform == normalizedPlatform &&
                    record.PlatformUserIdHash == platformUserIdHash &&
                    record.IdempotencyKey == normalizedIdempotencyKey &&
                    record.ActionType == actionType,
                cancellationToken);

        if (existingRecord is not null)
        {
            if (!string.Equals(existingRecord.PayloadHash, payloadHash, StringComparison.Ordinal))
            {
                return Reservation<TResponse>.Conflict();
            }

            if (string.Equals(existingRecord.Status, BotIdempotencyRecordStatus.Completed, StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(existingRecord.ResponseJson))
            {
                var response = JsonSerializer.Deserialize<TResponse>(existingRecord.ResponseJson, SerializerOptions);
                if (response is not null)
                {
                    return Reservation<TResponse>.Replay(response);
                }
            }

            return Reservation<TResponse>.Conflict();
        }

        var now = DateTimeOffset.UtcNow;
        var record = new BotIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            Platform = normalizedPlatform,
            PlatformUserIdHash = platformUserIdHash,
            IdempotencyKey = normalizedIdempotencyKey,
            ActionType = actionType,
            PayloadHash = payloadHash,
            Status = BotIdempotencyRecordStatus.Pending,
            CreatedAt = now,
            ExpiresAt = now.Add(options.Value.RecordTtl)
        };

        dbContext.BotIdempotencyRecords.Add(record);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return await ReserveAsync<TResponse>(
                identity,
                actionType,
                idempotencyKey,
                payloadJson,
                cancellationToken);
        }

        return Reservation<TResponse>.Started(record.Id);
    }

    public async Task CompleteAsync<TResponse>(
        Guid recordId,
        TResponse response,
        CancellationToken cancellationToken)
    {
        var record = await dbContext.BotIdempotencyRecords
            .SingleAsync(candidate => candidate.Id == recordId, cancellationToken);

        record.Status = BotIdempotencyRecordStatus.Completed;
        record.ResponseJson = JsonSerializer.Serialize(response, SerializerOptions);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ReleaseAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var record = await dbContext.BotIdempotencyRecords
            .SingleOrDefaultAsync(candidate => candidate.Id == recordId, cancellationToken);

        if (record is null ||
            !string.Equals(record.Status, BotIdempotencyRecordStatus.Pending, StringComparison.Ordinal))
        {
            return;
        }

        dbContext.BotIdempotencyRecords.Remove(record);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    internal sealed record Reservation<TResponse>(
        ReservationState State,
        Guid? RecordId = null,
        TResponse? Response = default)
    {
        public static Reservation<TResponse> Started(Guid recordId) =>
            new(ReservationState.Started, recordId);

        public static Reservation<TResponse> Replay(TResponse response) =>
            new(ReservationState.Replay, Response: response);

        public static Reservation<TResponse> Conflict() =>
            new(ReservationState.Conflict);
    }

    internal enum ReservationState
    {
        Started = 0,
        Replay = 1,
        Conflict = 2
    }
}
