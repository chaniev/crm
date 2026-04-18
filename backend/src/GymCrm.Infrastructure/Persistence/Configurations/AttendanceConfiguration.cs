using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

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
