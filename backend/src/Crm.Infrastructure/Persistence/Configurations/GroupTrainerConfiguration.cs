using Crm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class GroupTrainerConfiguration : IEntityTypeConfiguration<GroupTrainer>
{
    public void Configure(EntityTypeBuilder<GroupTrainer> builder)
    {
        builder.HasKey(groupTrainer => new { groupTrainer.GroupId, groupTrainer.TrainerId });
    }
}
