using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMembershipIdempotencyRecordConfiguration : IEntityTypeConfiguration<ClientMembershipIdempotencyRecord>
{
    private const int IdempotencyKeyMaxLength = 128;
    private const int ActionTypeMaxLength = 128;
    private const int PayloadHashMaxLength = 128;
    private const int StatusMaxLength = 32;
    private const string RequiredValuesConstraint =
        "btrim(\"IdempotencyKey\") <> '' AND btrim(\"ActionType\") <> '' AND btrim(\"PayloadHash\") <> '' AND btrim(\"Status\") <> ''";

    public void Configure(EntityTypeBuilder<ClientMembershipIdempotencyRecord> builder)
    {
        builder.HasKey(record => record.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_ClientMembershipIdempotencyRecords_RequiredValues",
                RequiredValuesConstraint));

        builder.Property(record => record.IdempotencyKey)
            .HasMaxLength(IdempotencyKeyMaxLength)
            .IsRequired();

        builder.Property(record => record.ActionType)
            .HasMaxLength(ActionTypeMaxLength)
            .IsRequired();

        builder.Property(record => record.PayloadHash)
            .HasMaxLength(PayloadHashMaxLength)
            .IsRequired();

        builder.Property(record => record.Status)
            .HasMaxLength(StatusMaxLength)
            .IsRequired();

        builder.Property(record => record.CreatedAt).IsRequired();
        builder.Property(record => record.UpdatedAt).IsRequired();
        builder.Property(record => record.ExpiresAt).IsRequired();

        builder.HasIndex(record => new
            {
                record.ActorUserId,
                record.IdempotencyKey
            })
            .HasDatabaseName(GymCrmDbContext.ClientMembershipIdempotencyActorKeyIndexName)
            .IsUnique();

        builder.HasIndex(record => record.ExpiresAt);
    }
}
