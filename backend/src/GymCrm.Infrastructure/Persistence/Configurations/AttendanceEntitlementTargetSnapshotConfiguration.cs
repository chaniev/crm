using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceEntitlementTargetSnapshotConfiguration : IEntityTypeConfiguration<AttendanceEntitlementTargetSnapshot>
{
    private const int EnumMaxLength = 32;
    private const int ProvenanceMaxLength = 32;

    public void Configure(EntityTypeBuilder<AttendanceEntitlementTargetSnapshot> builder)
    {
        builder.HasKey(snapshot => snapshot.Id);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_AttendanceEntitlementTargetSnapshots_Position",
                "\"Position\" >= 0 AND \"Position\" <= 4");
        });

        builder.Property(snapshot => snapshot.CoverageKind)
            .HasConversion<string>()
            .HasMaxLength(EnumMaxLength)
            .IsRequired();
        builder.Property(snapshot => snapshot.Provenance)
            .HasMaxLength(ProvenanceMaxLength)
            .IsRequired();
        builder.Property(snapshot => snapshot.CreatedAt).IsRequired();

        builder.HasIndex(snapshot => snapshot.AttendanceId);
        builder.HasIndex(snapshot => new { snapshot.ClientId, snapshot.TrainingDate });
        builder.HasIndex(snapshot => snapshot.FactualGroupId);
        builder.HasIndex(snapshot => snapshot.TargetGroupId);
        builder.HasIndex(snapshot => snapshot.SaleId);
        builder.HasIndex(snapshot => snapshot.MembershipId);

        builder.HasOne(snapshot => snapshot.FactualGroup)
            .WithMany()
            .HasForeignKey(snapshot => snapshot.FactualGroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(snapshot => snapshot.TargetGroup)
            .WithMany()
            .HasForeignKey(snapshot => snapshot.TargetGroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<GymCrm.Domain.Branches.Branch>()
            .WithMany()
            .HasForeignKey(snapshot => snapshot.TargetBranchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
