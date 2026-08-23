using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class LessonScheduleSlotConfiguration : IEntityTypeConfiguration<LessonScheduleSlot>
{
    public void Configure(EntityTypeBuilder<LessonScheduleSlot> builder)
    {
        builder.HasKey(slot => slot.Id);

        builder.Property(slot => slot.CreatedAt).IsRequired();

        builder.HasIndex(slot => new { slot.LessonScheduleRuleVersionId, slot.SlotLineageId })
            .IsUnique();
        builder.HasIndex(slot => new { slot.LessonScheduleRuleVersionId, slot.IsoWeekday, slot.StartTime });
        builder.HasIndex(slot => slot.HallId);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_LessonScheduleSlots_IsoWeekday",
                "\"IsoWeekday\" >= 1 AND \"IsoWeekday\" <= 7");
            table.HasCheckConstraint(
                "CK_LessonScheduleSlots_DurationMinutes",
                "\"DurationMinutes\" >= 1 AND \"DurationMinutes\" <= 180");
        });

        builder.HasOne(slot => slot.RuleVersion)
            .WithMany(version => version.Slots)
            .HasForeignKey(slot => slot.LessonScheduleRuleVersionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(slot => slot.Hall)
            .WithMany()
            .HasForeignKey(slot => slot.HallId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
