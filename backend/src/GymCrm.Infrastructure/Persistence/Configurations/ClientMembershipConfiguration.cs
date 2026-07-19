using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipConfiguration : IEntityTypeConfiguration<ClientMembership>
{
    private const int EnumMaxLength = 32;
    private const int PaymentAmountPrecision = 10;
    private const int PaymentAmountScale = 2;
    private const string PaymentAmountNonNegativeConstraintName = "CK_ClientMemberships_PaymentAmount_NonNegative";
    private const string PaymentAmountNonNegativeConstraintSql = "\"PaymentAmount\" >= 0";
    private const string CurrentMembershipIndexFilter = "\"ValidTo\" IS NULL";
    private const int ProfessionalCommentMaxLength = 1000;

    public void Configure(EntityTypeBuilder<ClientMembership> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            PaymentAmountNonNegativeConstraintName,
            PaymentAmountNonNegativeConstraintSql));

        builder.HasKey(membership => membership.Id);

        builder.Property(membership => membership.BehaviorKind)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();
        builder.Property(membership => membership.IndividualValidFrom);
        builder.Property(membership => membership.IndividualValidTo);
        builder.Property(membership => membership.ProfessionalComment)
            .HasMaxLength(ProfessionalCommentMaxLength);

        builder.Property(membership => membership.PaymentAmount)
            .HasPrecision(PaymentAmountPrecision, PaymentAmountScale)
            .IsRequired();

        builder.Property(membership => membership.ChangeReason)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();

        builder.Property(membership => membership.ValidFrom).IsRequired();
        builder.Property(membership => membership.CreatedAt).IsRequired();

        builder.HasIndex(membership => membership.ClientId);
        builder.HasIndex(membership => membership.SaleId);
        builder.HasIndex(membership => membership.MembershipCatalogItemId);
        builder.HasIndex(membership => membership.ValidTo);

        builder.HasIndex(membership => membership.ClientId)
            .IsUnique()
            .HasFilter(CurrentMembershipIndexFilter);

        builder.HasOne(membership => membership.Sale)
            .WithMany(sale => sale.Memberships)
            .HasForeignKey(membership => membership.SaleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(membership => membership.MembershipCatalogItem)
            .WithMany()
            .HasForeignKey(membership => membership.MembershipCatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
