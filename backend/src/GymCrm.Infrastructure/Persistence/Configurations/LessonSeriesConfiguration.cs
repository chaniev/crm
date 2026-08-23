using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class LessonSeriesConfiguration : IEntityTypeConfiguration<LessonSeries>
{
    public void Configure(EntityTypeBuilder<LessonSeries> builder)
    {
        builder.HasKey(series => series.Id);

        builder.Property(series => series.Version).IsRowVersion();
        builder.Property(series => series.CreatedAt).IsRequired();
        builder.Property(series => series.UpdatedAt).IsRequired();

        builder.HasIndex(series => series.GroupId).IsUnique();
        builder.HasIndex(series => new { series.StartsOn, series.EndsOn });

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_LessonSeries_DateRange",
                "\"EndsOn\" IS NULL OR \"EndsOn\" >= \"StartsOn\"");
        });

        builder.HasOne(series => series.Group)
            .WithOne()
            .HasForeignKey<LessonSeries>(series => series.GroupId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
