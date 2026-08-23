using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceTransitionRunConfiguration : IEntityTypeConfiguration<AttendanceTransitionRun>
{
    public void Configure(EntityTypeBuilder<AttendanceTransitionRun> builder)
    {
        builder.HasKey(run => run.Id);

        builder.Property(run => run.SourceSchemaVersion)
            .HasMaxLength(64)
            .IsRequired();
        builder.Property(run => run.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(run => run.CreatedAt).IsRequired();
        builder.Property(run => run.UpdatedAt).IsRequired();

        builder.HasIndex(run => run.SourceSchemaVersion)
            .IsUnique();
        builder.HasIndex(run => new { run.CutoverDate, run.Status });
    }
}
