using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class GroupTrainerAssignmentConfiguration : IEntityTypeConfiguration<GroupTrainerAssignment>
{
    private const string ActiveAssignmentIndexFilter = "\"ValidTo\" IS NULL";

    public void Configure(EntityTypeBuilder<GroupTrainerAssignment> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_GroupTrainerAssignments_Period_NonEmpty",
            "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\""));

        builder.HasKey(assignment => assignment.Id);

        builder.Property(assignment => assignment.ValidFrom).IsRequired();
        builder.Property(assignment => assignment.CreatedAt).IsRequired();

        builder.HasIndex(assignment => assignment.TrainerId);
        builder.HasIndex(assignment => assignment.GroupId);
        builder.HasIndex(assignment => assignment.CreatedByUserId);
        builder.HasIndex(assignment => new { assignment.TrainerId, assignment.GroupId, assignment.ValidFrom, assignment.ValidTo });
        builder.HasIndex(assignment => new { assignment.TrainerId, assignment.GroupId })
            .IsUnique()
            .HasFilter(ActiveAssignmentIndexFilter);

        builder.HasOne(assignment => assignment.Trainer)
            .WithMany(user => user.GroupTrainerAssignments)
            .HasForeignKey(assignment => assignment.TrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(assignment => assignment.Group)
            .WithMany(group => group.TrainerAssignments)
            .HasForeignKey(assignment => assignment.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(assignment => assignment.CreatedByUser)
            .WithMany(user => user.CreatedGroupTrainerAssignments)
            .HasForeignKey(assignment => assignment.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
