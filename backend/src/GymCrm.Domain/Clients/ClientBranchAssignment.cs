using GymCrm.Domain.Branches;
using GymCrm.Domain.Users;

namespace GymCrm.Domain.Clients;

public class ClientBranchAssignment
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly? ValidTo { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Client Client { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
