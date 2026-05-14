using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientGroupAssignmentConfiguration : IEntityTypeConfiguration<ClientGroupAssignment>
{
    private const string ActiveAssignmentIndexFilter = "\"ValidTo\" IS NULL";

    public void Configure(EntityTypeBuilder<ClientGroupAssignment> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_ClientGroupAssignments_Period_NonEmpty",
            "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\""));

        builder.HasKey(assignment => assignment.Id);

        builder.Property(assignment => assignment.ValidFrom).IsRequired();
        builder.Property(assignment => assignment.CreatedAt).IsRequired();

        builder.HasIndex(assignment => assignment.ClientId);
        builder.HasIndex(assignment => assignment.GroupId);
        builder.HasIndex(assignment => assignment.CreatedByUserId);
        builder.HasIndex(assignment => new { assignment.ClientId, assignment.GroupId, assignment.ValidFrom, assignment.ValidTo });
        builder.HasIndex(assignment => new { assignment.ClientId, assignment.GroupId })
            .IsUnique()
            .HasFilter(ActiveAssignmentIndexFilter);

        builder.HasOne(assignment => assignment.Client)
            .WithMany(client => client.GroupAssignments)
            .HasForeignKey(assignment => assignment.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(assignment => assignment.Group)
            .WithMany(group => group.ClientAssignments)
            .HasForeignKey(assignment => assignment.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(assignment => assignment.CreatedByUser)
            .WithMany(user => user.CreatedClientGroupAssignments)
            .HasForeignKey(assignment => assignment.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
