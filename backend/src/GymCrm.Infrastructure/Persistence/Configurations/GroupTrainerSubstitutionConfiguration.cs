using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class GroupTrainerSubstitutionConfiguration : IEntityTypeConfiguration<GroupTrainerSubstitution>
{
    public void Configure(EntityTypeBuilder<GroupTrainerSubstitution> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_GroupTrainerSubstitutions_Period_Inclusive",
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

        builder.HasOne(substitution => substitution.Group)
            .WithMany(group => group.TrainerSubstitutions)
            .HasForeignKey(substitution => substitution.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(substitution => substitution.SubstituteTrainer)
            .WithMany(user => user.GroupTrainerSubstitutions)
            .HasForeignKey(substitution => substitution.SubstituteTrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(substitution => substitution.CreatedByUser)
            .WithMany(user => user.CreatedGroupTrainerSubstitutions)
            .HasForeignKey(substitution => substitution.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
