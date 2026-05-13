namespace GymCrm.Domain.Groups;

public class GroupType
{
    public const int NameMaxLength = 128;
    public const int DescriptionMaxLength = 1000;
    public const int SystemIdentifierMaxLength = 128;

    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SystemIdentifier { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<TrainingGroup> Groups { get; set; } = new List<TrainingGroup>();
}
