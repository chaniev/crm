using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Clients;

public class ClientMembershipRefundTargetSnapshot
{
    public Guid RefundId { get; set; }
    public Guid GroupId { get; set; }
    public Guid BranchId { get; set; }
    public int Position { get; set; }
    public string Provenance { get; set; } = "Write";

    public ClientMembershipRefund Refund { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
}
