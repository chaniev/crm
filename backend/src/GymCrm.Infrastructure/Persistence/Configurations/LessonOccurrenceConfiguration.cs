using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class LessonOccurrenceConfiguration : IEntityTypeConfiguration<LessonOccurrence>
{
    public void Configure(EntityTypeBuilder<LessonOccurrence> builder)
    {
        builder.HasKey(occurrence => occurrence.Id);

        builder.Property(occurrence => occurrence.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(occurrence => occurrence.SourceKind)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(occurrence => occurrence.Version).IsRowVersion();
        builder.Property(occurrence => occurrence.CreatedAt).IsRequired();
        builder.Property(occurrence => occurrence.UpdatedAt).IsRequired();

        builder.HasIndex(occurrence => new { occurrence.Id, occurrence.LessonDate });
        builder.HasIndex(occurrence => new { occurrence.GroupId, occurrence.LessonDate, occurrence.StartTime });
        builder.HasIndex(occurrence => occurrence.SourceSlotLineageId);
        builder.HasIndex(occurrence => occurrence.HallId);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_LessonOccurrences_DurationMinutes",
                "\"DurationMinutes\" >= 1 AND \"DurationMinutes\" <= 180");
        });

        builder.HasOne(occurrence => occurrence.Group)
            .WithMany()
            .HasForeignKey(occurrence => occurrence.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(occurrence => occurrence.Hall)
            .WithMany()
            .HasForeignKey(occurrence => occurrence.HallId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(occurrence => occurrence.SourceLessonSeries)
            .WithMany()
            .HasForeignKey(occurrence => occurrence.SourceLessonSeriesId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(occurrence => occurrence.SourceRuleVersion)
            .WithMany()
            .HasForeignKey(occurrence => occurrence.SourceRuleVersionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(occurrence => occurrence.SourceSlot)
            .WithMany()
            .HasForeignKey(occurrence => occurrence.SourceSlotId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
