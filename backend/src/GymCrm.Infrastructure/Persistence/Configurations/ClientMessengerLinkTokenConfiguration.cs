using GymCrm.Domain.Messenger;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMessengerLinkTokenConfiguration : IEntityTypeConfiguration<ClientMessengerLinkToken>
{
    private const int PlatformMaxLength = 32;
    private const int TokenHashMaxLength = 128;
    private const int PlatformUserIdHashMaxLength = 128;
    private const string RequiredValuesConstraint = "btrim(\"TokenHash\") <> ''";

    public void Configure(EntityTypeBuilder<ClientMessengerLinkToken> builder)
    {
        builder.HasKey(token => token.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_ClientMessengerLinkTokens_RequiredValues",
                RequiredValuesConstraint));

        builder.Property(token => token.Platform)
            .HasConversion<string>()
            .HasMaxLength(PlatformMaxLength)
            .IsRequired();

        builder.Property(token => token.TokenHash)
            .HasMaxLength(TokenHashMaxLength)
            .IsRequired();

        builder.Property(token => token.UsedByPlatformUserIdHash)
            .HasMaxLength(PlatformUserIdHashMaxLength);

        builder.Property(token => token.CreatedAt).IsRequired();
        builder.Property(token => token.ExpiresAt).IsRequired();

        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => new { token.ClientId, token.Platform, token.ExpiresAt });
        builder.HasIndex(token => new { token.Platform, token.UsedAt });

        builder.HasOne(token => token.Client)
            .WithMany(client => client.MessengerLinkTokens)
            .HasForeignKey(token => token.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(token => token.CreatedByUser)
            .WithMany(user => user.CreatedMessengerLinkTokens)
            .HasForeignKey(token => token.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
