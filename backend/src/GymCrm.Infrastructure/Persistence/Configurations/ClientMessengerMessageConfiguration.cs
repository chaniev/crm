using GymCrm.Domain.Messenger;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMessengerMessageConfiguration : IEntityTypeConfiguration<ClientMessengerMessage>
{
    private const int PlatformMaxLength = 32;
    private const int DirectionMaxLength = 32;
    private const int StatusMaxLength = 32;
    private const int TelegramChatIdMaxLength = 128;
    private const int TelegramUserIdHashMaxLength = 128;
    private const int IdempotencyKeyMaxLength = 128;
    private const int IdempotencyPayloadHashMaxLength = 128;
    private const int FailureReasonMaxLength = ClientMessengerMessage.FailureReasonMaxLength;
    private const string InboundUpdateFilter = "\"TelegramUpdateId\" IS NOT NULL";
    private const string TelegramMessageFilter =
        "\"TelegramMessageId\" IS NOT NULL AND \"TelegramChatId\" IS NOT NULL AND btrim(\"TelegramChatId\") <> ''";
    private const string OutboundIdempotencyFilter =
        "\"IdempotencyKey\" IS NOT NULL AND btrim(\"IdempotencyKey\") <> ''";
    private const string RequiredTextConstraint = "btrim(\"Text\") <> ''";

    public void Configure(EntityTypeBuilder<ClientMessengerMessage> builder)
    {
        builder.HasKey(message => message.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_ClientMessengerMessages_Text_Required",
                RequiredTextConstraint));

        builder.Property(message => message.Platform)
            .HasConversion<string>()
            .HasMaxLength(PlatformMaxLength)
            .IsRequired();

        builder.Property(message => message.Direction)
            .HasConversion<string>()
            .HasMaxLength(DirectionMaxLength)
            .IsRequired();

        builder.Property(message => message.Status)
            .HasConversion<string>()
            .HasMaxLength(StatusMaxLength)
            .IsRequired();

        builder.Property(message => message.Text)
            .HasMaxLength(ClientMessengerMessage.TextMaxLength)
            .IsRequired();

        builder.Property(message => message.TelegramChatId)
            .HasMaxLength(TelegramChatIdMaxLength);

        builder.Property(message => message.TelegramUserIdHash)
            .HasMaxLength(TelegramUserIdHashMaxLength);

        builder.Property(message => message.IdempotencyKey)
            .HasMaxLength(IdempotencyKeyMaxLength);

        builder.Property(message => message.IdempotencyPayloadHash)
            .HasMaxLength(IdempotencyPayloadHashMaxLength);

        builder.Property(message => message.FailureReason)
            .HasMaxLength(FailureReasonMaxLength);

        builder.Property(message => message.CreatedAt).IsRequired();
        builder.Property(message => message.UpdatedAt).IsRequired();

        builder.HasIndex(message => new { message.ClientId, message.Platform, message.CreatedAt });
        builder.HasIndex(message => new { message.ClientId, message.Platform, message.Direction, message.CreatedAt });

        builder.HasIndex(message => new { message.Platform, message.TelegramUpdateId })
            .IsUnique()
            .HasFilter(InboundUpdateFilter);

        builder.HasIndex(message => new { message.Platform, message.TelegramChatId, message.TelegramMessageId })
            .IsUnique()
            .HasFilter(TelegramMessageFilter);

        builder.HasIndex(message => new { message.ClientId, message.Platform, message.IdempotencyKey })
            .IsUnique()
            .HasFilter(OutboundIdempotencyFilter);

        builder.HasOne(message => message.Client)
            .WithMany(client => client.MessengerMessages)
            .HasForeignKey(message => message.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(message => message.Account)
            .WithMany(account => account.Messages)
            .HasForeignKey(message => message.AccountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(message => message.CreatedByUser)
            .WithMany(user => user.CreatedMessengerMessages)
            .HasForeignKey(message => message.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
