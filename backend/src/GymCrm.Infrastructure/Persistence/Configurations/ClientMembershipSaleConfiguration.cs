using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipSaleConfiguration : IEntityTypeConfiguration<ClientMembershipSale>
{
    private const int EnumMaxLength = 32;
    private const int MoneyPrecision = 10;
    private const int MoneyScale = 2;

    public void Configure(EntityTypeBuilder<ClientMembershipSale> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_ClientMembershipSales_GrossAmount_NonNegative",
            "\"GrossAmount\" >= 0"));

        builder.HasKey(sale => sale.Id);

        builder.Property(sale => sale.MembershipType)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();

        builder.Property(sale => sale.GrossAmount)
            .HasPrecision(MoneyPrecision, MoneyScale)
            .IsRequired();

        builder.Property(sale => sale.PurchaseDate).IsRequired();
        builder.Property(sale => sale.CreatedAt).IsRequired();

        builder.HasIndex(sale => sale.ClientId);
        builder.HasIndex(sale => sale.PurchaseDate);
        builder.HasIndex(sale => sale.CreatedByUserId);

        builder.HasOne(sale => sale.Client)
            .WithMany(client => client.MembershipSales)
            .HasForeignKey(sale => sale.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sale => sale.CreatedByUser)
            .WithMany(user => user.CreatedMembershipSales)
            .HasForeignKey(sale => sale.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
