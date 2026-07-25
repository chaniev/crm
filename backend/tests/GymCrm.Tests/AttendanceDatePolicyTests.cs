using GymCrm.Application.Attendance;
using GymCrm.Domain.Users;

namespace GymCrm.Tests;

public sealed class AttendanceDatePolicyTests
{
    private static readonly DateOnly Today = new(2026, 7, 24);

    [Fact]
    public void Coach_window_allows_only_today_and_previous_two_days()
    {
        var policy = CreatePolicy();

        var window = policy.GetWindow(UserRole.Coach);

        Assert.Equal(Today.AddDays(-2), window.MinTrainingDate);
        Assert.Equal(Today, window.MaxTrainingDate);
        Assert.Equal(Today, window.Today);
        Assert.False(policy.IsAllowed(UserRole.Coach, Today.AddDays(-3)));
        Assert.True(policy.IsAllowed(UserRole.Coach, Today.AddDays(-2)));
        Assert.True(policy.IsAllowed(UserRole.Coach, Today));
        Assert.False(policy.IsAllowed(UserRole.Coach, Today.AddDays(1)));
    }

    [Theory]
    [InlineData(UserRole.Administrator)]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    public void Elevated_attendance_roles_allow_any_past_date_but_reject_future(UserRole role)
    {
        var policy = CreatePolicy();

        var window = policy.GetWindow(role);

        Assert.Null(window.MinTrainingDate);
        Assert.Equal(Today, window.MaxTrainingDate);
        Assert.Equal(Today, window.Today);
        Assert.True(policy.IsAllowed(role, Today.AddYears(-20)));
        Assert.True(policy.IsAllowed(role, Today));
        Assert.False(policy.IsAllowed(role, Today.AddDays(1)));
    }

    private static AttendanceDatePolicy CreatePolicy() =>
        new(new FixedBusinessDateProvider(Today));

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today => today;
    }
}
