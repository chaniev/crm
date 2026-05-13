using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class TrainingGroupConfiguration : IEntityTypeConfiguration<TrainingGroup>
{
    private const int NameMaxLength = 128;
    private const int MinDurationMinutes = 1;
    private const int MaxDurationMinutes = 180;

    public void Configure(EntityTypeBuilder<TrainingGroup> builder)
    {
        builder.HasKey(group => group.Id);
        builder.HasAlternateKey(group => new { group.Id, group.BranchId });

        builder.Property(group => group.Name)
            .HasMaxLength(NameMaxLength)
            .IsRequired();

        builder.Property(group => group.DurationMinutes)
            .IsRequired();

        builder.Property(group => group.Weekdays)
            .HasColumnType("integer[]")
            .IsRequired();

        builder.Property(group => group.CreatedAt).IsRequired();
        builder.Property(group => group.UpdatedAt).IsRequired();

        builder.HasIndex(group => group.Name);
        builder.HasIndex(group => group.BranchId);
        builder.HasIndex(group => group.HallId);
        builder.HasIndex(group => group.GroupTypeId);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_TrainingGroups_DurationMinutes_Range",
                $"""
                "DurationMinutes" >= {MinDurationMinutes} AND "DurationMinutes" <= {MaxDurationMinutes}
                """);
            table.HasCheckConstraint(
                "CK_TrainingGroups_Weekdays_NotEmpty",
                "cardinality(\"Weekdays\") >= 1");
        });

        builder.HasOne(group => group.Branch)
            .WithMany(branch => branch.Groups)
            .HasForeignKey(group => group.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(group => group.Hall)
            .WithMany(hall => hall.Groups)
            .HasForeignKey(group => new { group.HallId, group.BranchId })
            .HasPrincipalKey(hall => new { hall.Id, hall.BranchId })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(group => group.GroupType)
            .WithMany(groupType => groupType.Groups)
            .HasForeignKey(group => group.GroupTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(group => group.Trainers)
            .WithOne(groupTrainer => groupTrainer.Group)
            .HasForeignKey(groupTrainer => groupTrainer.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(group => group.AttendanceEntries)
            .WithOne(attendance => attendance.Group)
            .HasForeignKey(attendance => attendance.GroupId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
