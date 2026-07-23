using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipRefundConfiguration : IEntityTypeConfiguration<ClientMembershipRefund>
{
    private const int MoneyPrecision = 10;
    private const int MoneyScale = 2;

    public void Configure(EntityTypeBuilder<ClientMembershipRefund> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_ClientMembershipRefunds_Amount_Positive",
                "\"Amount\" > 0");
            table.HasCheckConstraint(
                "CK_ClientMembershipRefunds_Amount_WholeRub",
                "\"Amount\" = trunc(\"Amount\")");
        });

        builder.HasKey(refund => refund.Id);

        builder.Property(refund => refund.Amount)
            .HasPrecision(MoneyPrecision, MoneyScale)
            .IsRequired();

        builder.Property(refund => refund.RefundDate).IsRequired();
        builder.Property(refund => refund.Comment).HasMaxLength(ClientMembershipRefund.CommentMaxLength);
        builder.Property(refund => refund.CreatedAt).IsRequired();

        builder.HasIndex(refund => refund.SaleId);
        builder.HasIndex(refund => refund.ClientId);
        builder.HasIndex(refund => refund.RefundDate);
        builder.HasIndex(refund => refund.CanceledAt);
        builder.HasIndex(refund => refund.CreatedByUserId);
        builder.HasIndex(refund => refund.CanceledByUserId);

        builder.HasOne(refund => refund.Sale)
            .WithMany(sale => sale.Refunds)
            .HasForeignKey(refund => refund.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(refund => refund.Client)
            .WithMany(client => client.MembershipRefunds)
            .HasForeignKey(refund => refund.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(refund => refund.CreatedByUser)
            .WithMany(user => user.CreatedMembershipRefunds)
            .HasForeignKey(refund => refund.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(refund => refund.CanceledByUser)
            .WithMany(user => user.CanceledMembershipRefunds)
            .HasForeignKey(refund => refund.CanceledByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
