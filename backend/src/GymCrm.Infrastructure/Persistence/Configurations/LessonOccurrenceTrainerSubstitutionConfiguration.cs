using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class LessonOccurrenceTrainerSubstitutionConfiguration : IEntityTypeConfiguration<LessonOccurrenceTrainerSubstitution>
{
    private const string ActiveSubstitutionIndexFilter = "\"CancelledAt\" IS NULL";

    public void Configure(EntityTypeBuilder<LessonOccurrenceTrainerSubstitution> builder)
    {
        builder.HasKey(substitution => substitution.Id);

        builder.Property(substitution => substitution.CreatedAt).IsRequired();
        builder.Property(substitution => substitution.UpdatedAt)
            .IsRequired()
            .IsConcurrencyToken();
        builder.Property(substitution => substitution.CancellationReason)
            .HasMaxLength(512);

        builder.HasIndex(substitution => substitution.LessonOccurrenceId);
        builder.HasIndex(substitution => substitution.ReplacedTrainerId);
        builder.HasIndex(substitution => substitution.SubstituteTrainerId);
        builder.HasIndex(substitution => substitution.CreatedByUserId);
        builder.HasIndex(substitution => substitution.UpdatedByUserId);
        builder.HasIndex(substitution => substitution.CancelledByUserId);
        builder.HasIndex(substitution => substitution.SourceGroupTrainerSubstitutionId);
        builder.HasIndex(substitution => new
        {
            substitution.SourceGroupTrainerSubstitutionId,
            substitution.LessonOccurrenceId
        })
            .IsUnique()
            .HasFilter("\"SourceGroupTrainerSubstitutionId\" IS NOT NULL");
        builder.HasIndex(substitution => new
        {
            substitution.LessonOccurrenceId,
            substitution.ReplacedTrainerId
        })
            .IsUnique()
            .HasFilter(ActiveSubstitutionIndexFilter);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_LessonOccurrenceTrainerSubstitutions_DifferentTrainers",
                "\"ReplacedTrainerId\" <> \"SubstituteTrainerId\"");
            table.HasCheckConstraint(
                "CK_LessonOccurrenceTrainerSubstitutions_CancelledMetadata",
                "(\"CancelledAt\" IS NULL AND \"CancelledByUserId\" IS NULL) OR (\"CancelledAt\" IS NOT NULL AND \"CancelledByUserId\" IS NOT NULL)");
        });

        builder.HasOne(substitution => substitution.LessonOccurrence)
            .WithMany(occurrence => occurrence.TrainerSubstitutions)
            .HasForeignKey(substitution => substitution.LessonOccurrenceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(substitution => substitution.ReplacedTrainer)
            .WithMany()
            .HasForeignKey(substitution => substitution.ReplacedTrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.SubstituteTrainer)
            .WithMany()
            .HasForeignKey(substitution => substitution.SubstituteTrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.CreatedByUser)
            .WithMany()
            .HasForeignKey(substitution => substitution.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.UpdatedByUser)
            .WithMany()
            .HasForeignKey(substitution => substitution.UpdatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.CancelledByUser)
            .WithMany()
            .HasForeignKey(substitution => substitution.CancelledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.SourceGroupTrainerSubstitution)
            .WithMany()
            .HasForeignKey(substitution => substitution.SourceGroupTrainerSubstitutionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
