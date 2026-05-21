using GymCrm.Domain.Messenger;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMessengerAccountConfiguration : IEntityTypeConfiguration<ClientMessengerAccount>
{
    private const int PlatformMaxLength = 32;
    private const int PlatformUserIdMaxLength = 128;
    private const int PlatformUserIdHashMaxLength = 128;
    private const int UsernameMaxLength = 128;
    private const int DisplayNameMaxLength = 256;
    private const string ActiveAccountFilter = "\"UnlinkedAt\" IS NULL";
    private const string RequiredValuesConstraint =
        "btrim(\"PlatformUserId\") <> '' AND btrim(\"PlatformUserIdHash\") <> ''";

    public void Configure(EntityTypeBuilder<ClientMessengerAccount> builder)
    {
        builder.HasKey(account => account.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_ClientMessengerAccounts_RequiredValues",
                RequiredValuesConstraint));

        builder.Property(account => account.Platform)
            .HasConversion<string>()
            .HasMaxLength(PlatformMaxLength)
            .IsRequired();

        builder.Property(account => account.PlatformUserId)
            .HasMaxLength(PlatformUserIdMaxLength)
            .IsRequired();

        builder.Property(account => account.PlatformUserIdHash)
            .HasMaxLength(PlatformUserIdHashMaxLength)
            .IsRequired();

        builder.Property(account => account.Username)
            .HasMaxLength(UsernameMaxLength);

        builder.Property(account => account.DisplayName)
            .HasMaxLength(DisplayNameMaxLength);

        builder.Property(account => account.LinkedAt).IsRequired();
        builder.Property(account => account.CreatedAt).IsRequired();
        builder.Property(account => account.UpdatedAt).IsRequired();

        builder.HasIndex(account => new { account.ClientId, account.Platform })
            .IsUnique()
            .HasFilter(ActiveAccountFilter);

        builder.HasIndex(account => new { account.Platform, account.PlatformUserId })
            .IsUnique()
            .HasFilter(ActiveAccountFilter);

        builder.HasIndex(account => account.PlatformUserIdHash);

        builder.HasOne(account => account.Client)
            .WithMany(client => client.MessengerAccounts)
            .HasForeignKey(account => account.ClientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
