using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceTransitionRowResolutionConfiguration :
    IEntityTypeConfiguration<AttendanceTransitionRowResolution>
{
    public void Configure(EntityTypeBuilder<AttendanceTransitionRowResolution> builder)
    {
        builder.HasKey(resolution => resolution.Id);

        builder.Property(resolution => resolution.ResolutionKind)
            .HasMaxLength(64)
            .IsRequired();
        builder.Property(resolution => resolution.OperatorComment)
            .HasMaxLength(2000);
        builder.Property(resolution => resolution.ResolutionDigest)
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(resolution => resolution.ResolvedAt).IsRequired();

        builder.HasIndex(resolution => resolution.RunId);
        builder.HasIndex(resolution => resolution.ReportItemId);
        builder.HasIndex(resolution => resolution.TargetLessonOccurrenceId);
        builder.HasIndex(resolution => resolution.AttendanceRowId)
            .IsUnique();

        builder.HasOne(resolution => resolution.Run)
            .WithMany(run => run.RowResolutions)
            .HasForeignKey(resolution => resolution.RunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(resolution => resolution.ReportItem)
            .WithMany(item => item.RowResolutions)
            .HasForeignKey(resolution => resolution.ReportItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(resolution => resolution.AttendanceRow)
            .WithMany()
            .HasForeignKey(resolution => resolution.AttendanceRowId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(resolution => resolution.TargetLessonOccurrence)
            .WithMany()
            .HasForeignKey(resolution => resolution.TargetLessonOccurrenceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
