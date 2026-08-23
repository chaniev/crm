using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipTargetGroupConfiguration : IEntityTypeConfiguration<ClientMembershipTargetGroup>
{
    public void Configure(EntityTypeBuilder<ClientMembershipTargetGroup> builder)
    {
        builder.HasKey(target => new { target.ClientMembershipId, target.Position });

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_ClientMembershipTargetGroups_Position",
                "\"Position\" >= 0 AND \"Position\" <= 4");
        });

        builder.HasIndex(target => new { target.ClientMembershipId, target.GroupId }).IsUnique();
        builder.HasIndex(target => target.GroupId);
        builder.HasIndex(target => target.BranchId);

        builder.HasOne(target => target.ClientMembership)
            .WithMany(membership => membership.TargetGroups)
            .HasForeignKey(target => target.ClientMembershipId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(target => target.Group)
            .WithMany()
            .HasForeignKey(target => target.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<GymCrm.Domain.Branches.Branch>()
            .WithMany()
            .HasForeignKey(target => target.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
