using Crm.Domain.Users;

namespace Crm.Application.Authorization;

public interface IAccessScopeService
{
    Task<AccessScope> GetAccessScopeAsync(User user, CancellationToken cancellationToken);

    Task<GroupAccessDecision> EvaluateGroupAccessAsync(
        User user,
        Guid groupId,
        CancellationToken cancellationToken);
}
