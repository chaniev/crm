using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipSaleConfiguration : IEntityTypeConfiguration<ClientMembershipSale>
{
    private const int EnumMaxLength = 32;
    private const int MoneyPrecision = 10;
    private const int MoneyScale = 2;
    private const int CommentMaxLength = 2000;

    public void Configure(EntityTypeBuilder<ClientMembershipSale> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_ClientMembershipSales_GrossAmount_NonNegative",
                "\"GrossAmount\" >= 0");
            table.HasCheckConstraint(
                "CK_ClientMembershipSales_GrossAmount_WholeRub",
                "\"GrossAmount\" = trunc(\"GrossAmount\")");
            table.HasCheckConstraint(
                "CK_ClientMembershipSales_PricingMode_Catalog",
                "(\"PricingMode\" IN ('Catalog', 'CatalogOverride') AND \"MembershipCatalogItemId\" IS NOT NULL) OR (\"PricingMode\" = 'AmountOnly' AND \"MembershipCatalogItemId\" IS NULL)");
            table.HasCheckConstraint(
                "CK_ClientMembershipSales_Behavior_Pricing",
                "(\"BehaviorKind\" = 'Professional' AND \"PricingMode\" = 'Catalog' AND CAST(\"GrossAmount\" AS NUMERIC) = 0) OR (\"BehaviorKind\" = 'SingleVisit' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride') AND CAST(\"GrossAmount\" AS NUMERIC) > 0) OR (\"BehaviorKind\" = 'Term' AND \"PricingMode\" IN ('Catalog', 'CatalogOverride', 'AmountOnly') AND CAST(\"GrossAmount\" AS NUMERIC) > 0)");
        });

        builder.HasKey(sale => sale.Id);

        builder.Property(sale => sale.BehaviorKind)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();

        builder.Property(sale => sale.PricingMode)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();

        builder.Property(sale => sale.GrossAmount)
            .HasPrecision(MoneyPrecision, MoneyScale)
            .IsRequired();

        builder.Property(sale => sale.PurchaseDate).IsRequired();
        builder.Property(sale => sale.PaymentDate).IsRequired();
        builder.Property(sale => sale.CreatedAt).IsRequired();
        builder.Property(sale => sale.Comment).HasMaxLength(CommentMaxLength);

        builder.HasIndex(sale => sale.ClientId);
        builder.HasIndex(sale => sale.PurchaseDate);
        builder.HasIndex(sale => sale.PaymentDate);
        builder.HasIndex(sale => sale.CreatedByUserId);
        builder.HasIndex(sale => sale.MembershipCatalogItemId);
        builder.HasIndex(sale => sale.CommentChangedByUserId);

        builder.HasOne(sale => sale.Client)
            .WithMany(client => client.MembershipSales)
            .HasForeignKey(sale => sale.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sale => sale.CreatedByUser)
            .WithMany(user => user.CreatedMembershipSales)
            .HasForeignKey(sale => sale.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sale => sale.CommentChangedByUser)
            .WithMany(user => user.MembershipSalesWithCommentChanged)
            .HasForeignKey(sale => sale.CommentChangedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sale => sale.MembershipCatalogItem)
            .WithMany()
            .HasForeignKey(sale => sale.MembershipCatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
