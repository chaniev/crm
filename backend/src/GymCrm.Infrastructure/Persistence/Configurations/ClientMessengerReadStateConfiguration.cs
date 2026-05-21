using GymCrm.Domain.Messenger;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMessengerReadStateConfiguration : IEntityTypeConfiguration<ClientMessengerReadState>
{
    private const int PlatformMaxLength = 32;

    public void Configure(EntityTypeBuilder<ClientMessengerReadState> builder)
    {
        builder.HasKey(readState => readState.Id);

        builder.Property(readState => readState.Platform)
            .HasConversion<string>()
            .HasMaxLength(PlatformMaxLength)
            .IsRequired();

        builder.Property(readState => readState.LastReadAt).IsRequired();
        builder.Property(readState => readState.UpdatedAt).IsRequired();

        builder.HasIndex(readState => new { readState.ClientId, readState.Platform, readState.UserId })
            .IsUnique();

        builder.HasOne(readState => readState.Client)
            .WithMany(client => client.MessengerReadStates)
            .HasForeignKey(readState => readState.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(readState => readState.User)
            .WithMany(user => user.ClientMessengerReadStates)
            .HasForeignKey(readState => readState.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
