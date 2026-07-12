using GymCrm.Application.Attendance;
using Microsoft.Extensions.Options;

namespace GymCrm.Infrastructure.AttendanceFeatures;

internal sealed class BusinessDateProvider : IBusinessDateProvider
{
    private readonly TimeProvider timeProvider;
    private readonly TimeZoneInfo timeZone;

    public BusinessDateProvider(TimeProvider timeProvider, IOptions<BusinessTimeOptions> options)
    {
        this.timeProvider = timeProvider;
        timeZone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZoneId);
    }

    public DateOnly Today => DateOnly.FromDateTime(
        TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), timeZone).DateTime);
}
