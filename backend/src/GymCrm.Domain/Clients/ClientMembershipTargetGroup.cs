using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Clients;

public class ClientMembershipTargetGroup
{
    public Guid ClientMembershipId { get; set; }
    public Guid GroupId { get; set; }
    public Guid BranchId { get; set; }
    public int Position { get; set; }

    public ClientMembership ClientMembership { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
}
