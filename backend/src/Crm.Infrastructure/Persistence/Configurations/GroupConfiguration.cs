using Crm.Domain.Attendance;
using Crm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class TrainingGroupConfiguration : IEntityTypeConfiguration<TrainingGroup>
{
    public void Configure(EntityTypeBuilder<TrainingGroup> builder)
    {
        builder.HasKey(group => group.Id);

        builder.Property(group => group.Name)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(group => group.ScheduleText)
            .HasMaxLength(512)
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

internal sealed class ClientGroupConfiguration : IEntityTypeConfiguration<ClientGroup>
{
    public void Configure(EntityTypeBuilder<ClientGroup> builder)
    {
        builder.HasKey(clientGroup => new { clientGroup.ClientId, clientGroup.GroupId });
    }
}

internal sealed class GroupTrainerConfiguration : IEntityTypeConfiguration<GroupTrainer>
{
    public void Configure(EntityTypeBuilder<GroupTrainer> builder)
    {
        builder.HasKey(groupTrainer => new { groupTrainer.GroupId, groupTrainer.TrainerId });
    }
}

internal sealed class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> builder)
    {
        builder.HasKey(attendance => attendance.Id);

        builder.Property(attendance => attendance.MarkedAt).IsRequired();
        builder.Property(attendance => attendance.UpdatedAt).IsRequired();

        builder.HasIndex(attendance => new { attendance.GroupId, attendance.TrainingDate });

        builder.HasIndex(attendance => new
            {
                attendance.ClientId,
                attendance.GroupId,
                attendance.TrainingDate
            })
            .IsUnique();
    }
}
