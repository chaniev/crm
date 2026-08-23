using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceTransitionReportItemConfiguration : IEntityTypeConfiguration<AttendanceTransitionReportItem>
{
    public void Configure(EntityTypeBuilder<AttendanceTransitionReportItem> builder)
    {
        builder.HasKey(item => item.Id);

        builder.Property(item => item.AttendanceRowIdsJson)
            .HasColumnType("jsonb")
            .IsRequired();
        builder.Property(item => item.ReasonCode)
            .HasMaxLength(96)
            .IsRequired();
        builder.Property(item => item.ResolutionStatus)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(item => item.ResolutionKind)
            .HasMaxLength(64);
        builder.Property(item => item.OperatorComment)
            .HasMaxLength(2000);
        builder.Property(item => item.CreatedAt).IsRequired();
        builder.Property(item => item.UpdatedAt).IsRequired();

        builder.HasIndex(item => new { item.RunId, item.ResolutionStatus });
        builder.HasIndex(item => new { item.GroupId, item.TrainingDate });
        builder.HasIndex(item => item.TargetLessonOccurrenceId);

        builder.HasOne(item => item.Run)
            .WithMany(run => run.ReportItems)
            .HasForeignKey(item => item.RunId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
