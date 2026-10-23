using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;

namespace GymCrm.Tests;

public class BranchSettingsActionPolicyTests
{
    [Theory]
    [InlineData(UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator)]
    [InlineData(UserRole.Administrator)]
    [InlineData(UserRole.Coach)]
    public void Surface_mutations_are_a_subset_of_http_permissions(UserRole role)
    {
        var actor = new User { Role = role, IsActive = true, BranchId = role == UserRole.Administrator ? Guid.NewGuid() : null };
        foreach (var actionName in BranchSettingsActionPolicy.GetSurfaceActions(actor).Where(x => x != "View"))
        {
            var action = Enum.Parse<BranchSettingsAction>(actionName);
            Assert.True(BranchSettingsActionPolicy.CanMutateTarget(actor, action, Guid.NewGuid()));
        }
        Assert.False(BranchSettingsActionPolicy.CanAttemptMutation(actor, (BranchSettingsAction)999));
        actor.IsActive = false;
        Assert.Empty(BranchSettingsActionPolicy.GetSurfaceActions(actor));
        Assert.False(BranchSettingsActionPolicy.CanAttemptMutation(actor, BranchSettingsAction.CreateHall));
    }

    [Fact]
    public void Administrator_with_empty_scope_cannot_attempt_any_mutation()
    {
        var actor = new User { Role = UserRole.Administrator, IsActive = true, BranchId = Guid.Empty };
        foreach (var action in Enum.GetValues<BranchSettingsAction>())
        {
            Assert.False(BranchSettingsActionPolicy.CanAttemptMutation(actor, action));
        }
    }
}
