using GymCrm.Domain.Memberships;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class MembershipCatalogItemConfiguration : IEntityTypeConfiguration<MembershipCatalogItem>
{
    public static readonly Guid ProfessionalCatalogItemId = Guid.Parse("11111111-1111-4111-8111-111111111070");

    public void Configure(EntityTypeBuilder<MembershipCatalogItem> builder)
    {
        builder.HasKey(item => item.Id);

        builder.Property(item => item.Name)
            .HasMaxLength(MembershipCatalogItem.NameMaxLength)
            .IsRequired();
        builder.Property(item => item.NormalizedName)
            .HasMaxLength(MembershipCatalogItem.NameMaxLength)
            .IsRequired();
        builder.Property(item => item.Price).HasPrecision(10, 2).IsRequired();
        builder.Property(item => item.BehaviorKind)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(item => item.AvailableFrom).IsRequired();
        builder.Property(item => item.IsSystemOwned).IsRequired();
        builder.Property(item => item.CreatedAt).IsRequired();
        builder.Property(item => item.UpdatedAt).IsRequired();

        builder.HasOne(item => item.Branch)
            .WithMany(branch => branch.MembershipCatalogItems)
            .HasForeignKey(item => item.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(item => item.BranchId);
        builder.HasIndex(item => new { item.BranchId, item.NormalizedName, item.Price });
        builder.HasIndex(item => item.BehaviorKind)
            .IsUnique()
            .HasFilter("\"BehaviorKind\" = 'Professional'");

        builder.ToTable("MembershipCatalogItems", table =>
        {
            table.HasCheckConstraint("CK_MembershipCatalogItems_Name_NotBlank", "btrim(\"Name\") <> '' AND btrim(\"NormalizedName\") <> ''");
            table.HasCheckConstraint("CK_MembershipCatalogItems_Availability", "\"AvailableTo\" IS NULL OR \"AvailableTo\" >= \"AvailableFrom\"");
            table.HasCheckConstraint("CK_MembershipCatalogItems_Ownership", "(\"BehaviorKind\" = 'Professional' AND \"BranchId\" IS NULL AND \"IsSystemOwned\") OR (\"BehaviorKind\" IN ('SingleVisit', 'Term') AND \"BranchId\" IS NOT NULL AND NOT \"IsSystemOwned\")");
            table.HasCheckConstraint("CK_MembershipCatalogItems_Price", "(\"BehaviorKind\" = 'Professional' AND CAST(\"Price\" AS NUMERIC) = 0) OR (\"BehaviorKind\" IN ('SingleVisit', 'Term') AND CAST(\"Price\" AS NUMERIC) > 0)");
            table.HasCheckConstraint("CK_MembershipCatalogItems_Price_WholeRub", "\"Price\" = trunc(\"Price\")");
        });

        builder.HasData(new MembershipCatalogItem
        {
            Id = ProfessionalCatalogItemId,
            BranchId = null,
            Name = "Профессиональный",
            NormalizedName = "ПРОФЕССИОНАЛЬНЫЙ",
            Price = 0m,
            BehaviorKind = MembershipBehaviorKind.Professional,
            AvailableFrom = new DateOnly(2020, 1, 1),
            AvailableTo = null,
            IsSystemOwned = true,
            CreatedAt = new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero),
            UpdatedAt = new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero)
        });
    }
}
