using GymCrm.Domain.Branches;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class HallConfiguration : IEntityTypeConfiguration<Hall>
{
    public void Configure(EntityTypeBuilder<Hall> builder)
    {
        builder.HasKey(hall => hall.Id);
        builder.HasAlternateKey(hall => new { hall.Id, hall.BranchId });

        builder.Property(hall => hall.Name)
            .HasMaxLength(Hall.NameMaxLength)
            .IsRequired();

        builder.Property(hall => hall.Description).HasMaxLength(Hall.DescriptionMaxLength);
        builder.Property(hall => hall.IsArchived).IsRequired();
        builder.Property(hall => hall.CreatedAt).IsRequired();
        builder.Property(hall => hall.UpdatedAt).IsRequired();

        builder.HasIndex(hall => hall.BranchId);
        builder.HasIndex(hall => hall.Name);
        builder.HasIndex(hall => hall.IsArchived);

        builder.HasOne(hall => hall.Branch)
            .WithMany(branch => branch.Halls)
            .HasForeignKey(hall => hall.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
