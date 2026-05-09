using GymCrm.Domain.Branches;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.HasKey(branch => branch.Id);

        builder.Property(branch => branch.Name)
            .HasMaxLength(Branch.NameMaxLength)
            .IsRequired();

        builder.Property(branch => branch.Address).HasMaxLength(Branch.AddressMaxLength);
        builder.Property(branch => branch.Description).HasMaxLength(Branch.DescriptionMaxLength);
        builder.Property(branch => branch.IsArchived).IsRequired();
        builder.Property(branch => branch.CreatedAt).IsRequired();
        builder.Property(branch => branch.UpdatedAt).IsRequired();

        builder.HasIndex(branch => branch.Name);
        builder.HasIndex(branch => branch.IsArchived);
    }
}
