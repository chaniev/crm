using GymCrm.Domain.Branches;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Groups;

public class AdministratorAttendanceGroupGrant
{
    public Guid AdministratorId { get; set; }
    public Guid GroupId { get; set; }
    public Guid BranchId { get; set; }
    public Guid GrantedByUserId { get; set; }
    public DateTimeOffset GrantedAt { get; set; }

    public User Administrator { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public User GrantedByUser { get; set; } = null!;
}
