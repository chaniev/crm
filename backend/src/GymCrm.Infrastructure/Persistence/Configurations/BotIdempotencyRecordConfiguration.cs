using GymCrm.Domain.Bot;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class BotIdempotencyRecordConfiguration : IEntityTypeConfiguration<BotIdempotencyRecord>
{
    private const int PlatformMaxLength = 32;
    private const int PlatformUserIdHashMaxLength = 128;
    private const int IdempotencyKeyMaxLength = 128;
    private const int ActionTypeMaxLength = 128;
    private const int PayloadHashMaxLength = 128;
    private const int StatusMaxLength = 32;
    private const string JsonbColumnType = "jsonb";
    private const string RequiredValueConstraint =
        "btrim(\"Platform\") <> '' AND btrim(\"PlatformUserIdHash\") <> '' AND btrim(\"IdempotencyKey\") <> '' " +
        "AND btrim(\"ActionType\") <> '' AND btrim(\"PayloadHash\") <> '' AND btrim(\"Status\") <> ''";

    public void Configure(EntityTypeBuilder<BotIdempotencyRecord> builder)
    {
        builder.HasKey(record => record.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_BotIdempotencyRecords_RequiredValues",
                RequiredValueConstraint));

        builder.Property(record => record.Platform)
            .HasMaxLength(PlatformMaxLength)
            .IsRequired();

        builder.Property(record => record.PlatformUserIdHash)
            .HasMaxLength(PlatformUserIdHashMaxLength)
            .IsRequired();

        builder.Property(record => record.IdempotencyKey)
            .HasMaxLength(IdempotencyKeyMaxLength)
            .IsRequired();

        builder.Property(record => record.ActionType)
            .HasMaxLength(ActionTypeMaxLength)
            .IsRequired();

        builder.Property(record => record.PayloadHash)
            .HasMaxLength(PayloadHashMaxLength)
            .IsRequired();

        builder.Property(record => record.ResponseJson)
            .HasColumnType(JsonbColumnType);

        builder.Property(record => record.Status)
            .HasMaxLength(StatusMaxLength)
            .IsRequired();

        builder.Property(record => record.CreatedAt).IsRequired();
        builder.Property(record => record.ExpiresAt).IsRequired();

        builder.HasIndex(record => new
            {
                record.Platform,
                record.PlatformUserIdHash,
                record.IdempotencyKey,
                record.ActionType
            })
            .IsUnique();

        builder.HasIndex(record => record.ExpiresAt);
    }
}
