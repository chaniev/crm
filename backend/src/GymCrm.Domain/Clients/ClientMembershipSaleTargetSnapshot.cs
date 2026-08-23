using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Clients;

public class ClientMembershipSaleTargetSnapshot
{
    public Guid SaleId { get; set; }
    public Guid GroupId { get; set; }
    public Guid BranchId { get; set; }
    public int Position { get; set; }
    public string Provenance { get; set; } = "Write";

    public ClientMembershipSale Sale { get; set; } = null!;
    public TrainingGroup Group { get; set; } = null!;
}
