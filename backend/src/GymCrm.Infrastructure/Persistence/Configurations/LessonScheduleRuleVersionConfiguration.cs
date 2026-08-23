using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class LessonScheduleRuleVersionConfiguration : IEntityTypeConfiguration<LessonScheduleRuleVersion>
{
    public void Configure(EntityTypeBuilder<LessonScheduleRuleVersion> builder)
    {
        builder.HasKey(version => version.Id);

        builder.Property(version => version.CreatedAt).IsRequired();

        builder.HasIndex(version => new { version.LessonSeriesId, version.VersionNumber })
            .IsUnique();
        builder.HasIndex(version => new { version.LessonSeriesId, version.EffectiveFrom, version.EffectiveTo });

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_LessonScheduleRuleVersions_DateRange",
                "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
        });

        builder.HasOne(version => version.LessonSeries)
            .WithMany(series => series.RuleVersions)
            .HasForeignKey(version => version.LessonSeriesId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
