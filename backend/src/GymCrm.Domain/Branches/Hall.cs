using GymCrm.Domain.Groups;

namespace GymCrm.Domain.Branches;

public class Hall
{
    public const int NameMaxLength = 128;
    public const int DescriptionMaxLength = 1000;

    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Branch Branch { get; set; } = null!;
    public ICollection<TrainingGroup> Groups { get; set; } = new List<TrainingGroup>();
}
