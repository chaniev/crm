using GymCrm.Infrastructure.AttendanceFeatures;
using Microsoft.Extensions.Options;

namespace GymCrm.Tests;

public class BusinessDateProviderTests
{
    [Theory]
    [InlineData("2026-07-11T20:59:59+00:00", "2026-07-11")]
    [InlineData("2026-07-11T21:00:00+00:00", "2026-07-12")]
    public void Today_uses_configured_business_timezone(string utcNow, string expectedDate)
    {
        var provider = new BusinessDateProvider(
            new FixedTimeProvider(DateTimeOffset.Parse(utcNow)),
            Options.Create(new BusinessTimeOptions { TimeZoneId = "Europe/Moscow" }));

        Assert.Equal(DateOnly.Parse(expectedDate), provider.Today);
    }

    [Fact]
    public void Unknown_timezone_is_rejected()
    {
        Assert.Throws<TimeZoneNotFoundException>(() => new BusinessDateProvider(
            new FixedTimeProvider(DateTimeOffset.UtcNow),
            Options.Create(new BusinessTimeOptions { TimeZoneId = "Unknown/Club" })));
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
