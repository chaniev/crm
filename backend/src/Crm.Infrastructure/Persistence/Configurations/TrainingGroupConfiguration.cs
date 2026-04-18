using Crm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class TrainingGroupConfiguration : IEntityTypeConfiguration<TrainingGroup>
{
    private const int NameMaxLength = 128;
    private const int ScheduleTextMaxLength = 512;

    public void Configure(EntityTypeBuilder<TrainingGroup> builder)
    {
        builder.HasKey(group => group.Id);

        builder.Property(group => group.Name)
            .HasMaxLength(NameMaxLength)
            .IsRequired();

        builder.Property(group => group.ScheduleText)
            .HasMaxLength(ScheduleTextMaxLength)
            .IsRequired();

        builder.Property(group => group.CreatedAt).IsRequired();
        builder.Property(group => group.UpdatedAt).IsRequired();

        builder.HasIndex(group => group.Name);

        builder.HasMany(group => group.Clients)
            .WithOne(clientGroup => clientGroup.Group)
            .HasForeignKey(clientGroup => clientGroup.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

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
