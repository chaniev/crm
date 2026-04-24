namespace GymCrm.Infrastructure.Bot;

internal sealed class BotIdempotencyOptions
{
    public const string SectionName = "BotIdempotency";

    public TimeSpan RecordTtl { get; set; } = TimeSpan.FromDays(7);
}
