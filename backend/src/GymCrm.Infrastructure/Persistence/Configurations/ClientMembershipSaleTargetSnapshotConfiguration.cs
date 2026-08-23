using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipSaleTargetSnapshotConfiguration : IEntityTypeConfiguration<ClientMembershipSaleTargetSnapshot>
{
    private const int ProvenanceMaxLength = 32;

    public void Configure(EntityTypeBuilder<ClientMembershipSaleTargetSnapshot> builder)
    {
        builder.HasKey(snapshot => new { snapshot.SaleId, snapshot.Position });

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_ClientMembershipSaleTargetSnapshots_Position",
                "\"Position\" >= 0 AND \"Position\" <= 4");
        });

        builder.Property(snapshot => snapshot.Provenance)
            .HasMaxLength(ProvenanceMaxLength)
            .IsRequired();

        builder.HasIndex(snapshot => new { snapshot.SaleId, snapshot.GroupId }).IsUnique();
        builder.HasIndex(snapshot => snapshot.GroupId);
        builder.HasIndex(snapshot => snapshot.BranchId);

        builder.HasOne(snapshot => snapshot.Sale)
            .WithMany(sale => sale.TargetSnapshots)
            .HasForeignKey(snapshot => snapshot.SaleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(snapshot => snapshot.Group)
            .WithMany()
            .HasForeignKey(snapshot => snapshot.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<GymCrm.Domain.Branches.Branch>()
            .WithMany()
            .HasForeignKey(snapshot => snapshot.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
