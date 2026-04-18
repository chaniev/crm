using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientGroupConfiguration : IEntityTypeConfiguration<ClientGroup>
{
    public void Configure(EntityTypeBuilder<ClientGroup> builder)
    {
        builder.HasKey(clientGroup => new { clientGroup.ClientId, clientGroup.GroupId });
    }
}
