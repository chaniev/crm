using GymCrm.Application.Authorization;

namespace GymCrm.Tests;

public class GroupTrainerSubstitutionPolicyTests
{
    private static readonly DateOnly Today = new(2026, 7, 25);

    [Theory]
    [InlineData("2026-07-25", "2026-07-25")]
    [InlineData("2026-07-24", "2026-07-25")]
    [InlineData("2026-07-25", "2026-07-26")]
    public void Effective_period_uses_inclusive_start_and_end(string startsOn, string endsOn)
    {
        Assert.True(GroupTrainerSubstitutionPolicy.IsEffective(
            DateOnly.Parse(startsOn),
            DateOnly.Parse(endsOn),
            cancelledAt: null,
            Today));
    }

    [Theory]
    [InlineData("2026-07-26", "2026-07-27", GroupTrainerSubstitutionStatus.Upcoming)]
    [InlineData("2026-07-25", "2026-07-25", GroupTrainerSubstitutionStatus.Active)]
    [InlineData("2026-07-20", "2026-07-24", GroupTrainerSubstitutionStatus.Expired)]
    public void Status_is_computed_from_business_date_and_cancellation(
        string startsOn,
        string endsOn,
        GroupTrainerSubstitutionStatus expected)
    {
        var status = GroupTrainerSubstitutionPolicy.GetStatus(
            DateOnly.Parse(startsOn),
            DateOnly.Parse(endsOn),
            cancelledAt: null,
            Today);

        Assert.Equal(expected, status);
        Assert.Equal(
            GroupTrainerSubstitutionStatus.Cancelled,
            GroupTrainerSubstitutionPolicy.GetStatus(
                DateOnly.Parse(startsOn),
                DateOnly.Parse(endsOn),
                DateTimeOffset.Parse("2026-07-24T12:00:00Z"),
                Today));
    }

    [Theory]
    [InlineData("2026-07-20", "2026-07-25", "2026-07-25", "2026-07-30", true)]
    [InlineData("2026-07-20", "2026-07-25", "2026-07-26", "2026-07-30", false)]
    [InlineData("2026-07-20", "2026-07-25", "2026-07-19", "2026-07-20", true)]
    public void Overlap_uses_inclusive_boundaries(
        string leftStart,
        string leftEnd,
        string rightStart,
        string rightEnd,
        bool expected)
    {
        Assert.Equal(expected, GroupTrainerSubstitutionPolicy.Overlaps(
            DateOnly.Parse(leftStart),
            DateOnly.Parse(leftEnd),
            DateOnly.Parse(rightStart),
            DateOnly.Parse(rightEnd)));
    }

    [Fact]
    public void Allowed_actions_follow_lifecycle_group_state_and_permanent_assignment()
    {
        Assert.Equal(
            new GroupTrainerSubstitutionAllowedActions(CanEdit: true, CanCancel: true),
            GroupTrainerSubstitutionPolicy.GetAllowedActions(
                GroupTrainerSubstitutionStatus.Upcoming,
                isGroupActive: true,
                substituteIsPermanentTrainer: false));
        Assert.Equal(
            new GroupTrainerSubstitutionAllowedActions(CanEdit: false, CanCancel: true),
            GroupTrainerSubstitutionPolicy.GetAllowedActions(
                GroupTrainerSubstitutionStatus.Active,
                isGroupActive: true,
                substituteIsPermanentTrainer: true));
        Assert.Equal(
            new GroupTrainerSubstitutionAllowedActions(CanEdit: false, CanCancel: true),
            GroupTrainerSubstitutionPolicy.GetAllowedActions(
                GroupTrainerSubstitutionStatus.Active,
                isGroupActive: false,
                substituteIsPermanentTrainer: false));
        Assert.Equal(
            new GroupTrainerSubstitutionAllowedActions(CanEdit: false, CanCancel: false),
            GroupTrainerSubstitutionPolicy.GetAllowedActions(
                GroupTrainerSubstitutionStatus.Expired,
                isGroupActive: true,
                substituteIsPermanentTrainer: false));
        Assert.Equal(
            new GroupTrainerSubstitutionAllowedActions(CanEdit: false, CanCancel: false),
            GroupTrainerSubstitutionPolicy.GetAllowedActions(
                GroupTrainerSubstitutionStatus.Cancelled,
                isGroupActive: true,
                substituteIsPermanentTrainer: false));
    }
}
