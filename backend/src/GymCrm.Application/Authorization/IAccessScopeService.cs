using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public interface IAccessScopeService
{
    Task<AccessScope> GetAccessScopeAsync(User user, CancellationToken cancellationToken);

    Task<GroupAccessDecision> EvaluateGroupAccessAsync(
        User user,
        Guid groupId,
        CancellationToken cancellationToken);
}
