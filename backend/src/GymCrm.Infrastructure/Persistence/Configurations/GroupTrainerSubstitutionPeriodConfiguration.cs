using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class GroupTrainerSubstitutionPeriodConfiguration : IEntityTypeConfiguration<GroupTrainerSubstitutionPeriod>
{
    public void Configure(EntityTypeBuilder<GroupTrainerSubstitutionPeriod> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_GroupTrainerSubstitutionPeriods_Period_Inclusive",
            "\"EndsOn\" >= \"StartsOn\""));

        builder.HasKey(substitution => substitution.Id);

        builder.Property(substitution => substitution.StartsOn).IsRequired();
        builder.Property(substitution => substitution.EndsOn).IsRequired();
        builder.Property(substitution => substitution.CreatedAt).IsRequired();
        builder.Property(substitution => substitution.UpdatedAt)
            .IsRequired()
            .IsConcurrencyToken();

        builder.HasIndex(substitution => substitution.GroupId);
        builder.HasIndex(substitution => substitution.SubstituteTrainerId);
        builder.HasIndex(substitution => substitution.CreatedByUserId);
        builder.HasIndex(substitution => new
        {
            substitution.GroupId,
            substitution.SubstituteTrainerId,
            substitution.StartsOn,
            substitution.EndsOn
        });

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(substitution => substitution.CancelledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.Group)
            .WithMany()
            .HasForeignKey(substitution => substitution.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(substitution => substitution.SubstituteTrainer)
            .WithMany()
            .HasForeignKey(substitution => substitution.SubstituteTrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.CreatedByUser)
            .WithMany()
            .HasForeignKey(substitution => substitution.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
