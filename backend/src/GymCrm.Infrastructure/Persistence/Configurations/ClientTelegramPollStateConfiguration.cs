using GymCrm.Domain.Messenger;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientTelegramPollStateConfiguration : IEntityTypeConfiguration<ClientTelegramPollState>
{
    private const int BotNameMaxLength = 128;
    private const string RequiredBotNameConstraint = "btrim(\"BotName\") <> ''";

    public void Configure(EntityTypeBuilder<ClientTelegramPollState> builder)
    {
        builder.HasKey(state => state.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_ClientTelegramPollStates_BotName_Required",
                RequiredBotNameConstraint));

        builder.Property(state => state.BotName)
            .HasMaxLength(BotNameMaxLength)
            .IsRequired();

        builder.Property(state => state.CreatedAt).IsRequired();
        builder.Property(state => state.UpdatedAt).IsRequired();

        builder.HasIndex(state => state.BotName).IsUnique();
    }
}
