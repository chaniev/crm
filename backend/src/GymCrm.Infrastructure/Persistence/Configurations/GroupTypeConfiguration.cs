using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class GroupTypeConfiguration : IEntityTypeConfiguration<GroupType>
{
    public void Configure(EntityTypeBuilder<GroupType> builder)
    {
        builder.HasKey(groupType => groupType.Id);

        builder.Property(groupType => groupType.Name)
            .HasMaxLength(GroupType.NameMaxLength)
            .IsRequired();

        builder.Property(groupType => groupType.Description)
            .HasMaxLength(GroupType.DescriptionMaxLength);

        builder.Property(groupType => groupType.SystemIdentifier)
            .HasMaxLength(GroupType.SystemIdentifierMaxLength)
            .IsRequired();

        builder.Property(groupType => groupType.CreatedAt).IsRequired();
        builder.Property(groupType => groupType.UpdatedAt).IsRequired();

        builder.HasIndex(groupType => groupType.Name)
            .IsUnique();

        builder.HasIndex(groupType => groupType.SystemIdentifier)
            .IsUnique();

        builder.HasMany(groupType => groupType.Groups)
            .WithOne(group => group.GroupType)
            .HasForeignKey(group => group.GroupTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
