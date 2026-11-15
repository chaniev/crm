using GymCrm.Domain.Users;

namespace GymCrm.Application.Authorization;

public sealed record ClientImportScope(string Kind, Guid? BranchId)
{
    public static ClientImportScope For(User user) => !user.IsActive ? new("None", null) : user.Role switch
    {
        UserRole.SuperAdministrator => new("SelectBranch", null),
        UserRole.Administrator => new("OwnBranch", user.BranchId),
        _ => new("None", null)
    };

    public static bool Allows(User user, Guid branchId) => user.IsActive &&
        (user.Role == UserRole.SuperAdministrator || user.Role == UserRole.Administrator && user.BranchId == branchId);
}
