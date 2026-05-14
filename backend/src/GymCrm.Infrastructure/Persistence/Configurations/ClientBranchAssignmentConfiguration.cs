using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientBranchAssignmentConfiguration : IEntityTypeConfiguration<ClientBranchAssignment>
{
    private const string ActiveAssignmentIndexFilter = "\"ValidTo\" IS NULL";

    public void Configure(EntityTypeBuilder<ClientBranchAssignment> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_ClientBranchAssignments_Period_NonEmpty",
            "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\""));

        builder.HasKey(assignment => assignment.Id);

        builder.Property(assignment => assignment.ValidFrom).IsRequired();
        builder.Property(assignment => assignment.CreatedAt).IsRequired();

        builder.HasIndex(assignment => assignment.ClientId);
        builder.HasIndex(assignment => assignment.BranchId);
        builder.HasIndex(assignment => assignment.CreatedByUserId);
        builder.HasIndex(assignment => new { assignment.ClientId, assignment.ValidFrom, assignment.ValidTo });
        builder.HasIndex(assignment => assignment.ClientId)
            .IsUnique()
            .HasFilter(ActiveAssignmentIndexFilter);

        builder.HasOne(assignment => assignment.Client)
            .WithMany(client => client.BranchAssignments)
            .HasForeignKey(assignment => assignment.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(assignment => assignment.Branch)
            .WithMany(branch => branch.ClientAssignments)
            .HasForeignKey(assignment => assignment.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(assignment => assignment.CreatedByUser)
            .WithMany(user => user.CreatedClientBranchAssignments)
            .HasForeignKey(assignment => assignment.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
