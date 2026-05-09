using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientGroupConfiguration : IEntityTypeConfiguration<ClientGroup>
{
    public void Configure(EntityTypeBuilder<ClientGroup> builder)
    {
        builder.HasKey(clientGroup => new { clientGroup.ClientId, clientGroup.GroupId });

        builder.Property(clientGroup => clientGroup.BranchId).IsRequired();

        builder.HasIndex(clientGroup => clientGroup.BranchId);

        builder.HasOne(clientGroup => clientGroup.Client)
            .WithMany(client => client.Groups)
            .HasForeignKey(clientGroup => clientGroup.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(clientGroup => clientGroup.Group)
            .WithMany(group => group.Clients)
            .HasForeignKey(clientGroup => new { clientGroup.GroupId, clientGroup.BranchId })
            .HasPrincipalKey(group => new { group.Id, group.BranchId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
