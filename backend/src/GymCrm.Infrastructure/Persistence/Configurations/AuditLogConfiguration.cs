using GymCrm.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    private const int ActionTypeMaxLength = 128;
    private const int EntityTypeMaxLength = 128;
    private const int EntityIdMaxLength = 128;
    private const int DescriptionMaxLength = 2000;
    private const int SourceMaxLength = 32;
    private const int MessengerPlatformMaxLength = 32;
    private const int MessengerPlatformUserIdHashMaxLength = 128;
    private const string JsonbColumnType = "jsonb";

    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(auditLog => auditLog.Id);

        builder.Property(auditLog => auditLog.ActionType)
            .HasMaxLength(ActionTypeMaxLength)
            .IsRequired();

        builder.Property(auditLog => auditLog.EntityType)
            .HasMaxLength(EntityTypeMaxLength)
            .IsRequired();

        builder.Property(auditLog => auditLog.EntityId)
            .HasMaxLength(EntityIdMaxLength);

        builder.Property(auditLog => auditLog.Description)
            .HasMaxLength(DescriptionMaxLength)
            .IsRequired();

        builder.Property(auditLog => auditLog.Source)
            .HasMaxLength(SourceMaxLength)
            .HasDefaultValue("Web")
            .IsRequired();

        builder.Property(auditLog => auditLog.MessengerPlatform)
            .HasMaxLength(MessengerPlatformMaxLength);

        builder.Property(auditLog => auditLog.MessengerPlatformUserIdHash)
            .HasMaxLength(MessengerPlatformUserIdHashMaxLength);

        builder.Property(auditLog => auditLog.OldValueJson)
            .HasColumnType(JsonbColumnType);

        builder.Property(auditLog => auditLog.NewValueJson)
            .HasColumnType(JsonbColumnType);

        builder.Property(auditLog => auditLog.CreatedAt).IsRequired();

        builder.HasIndex(auditLog => auditLog.CreatedAt);
        builder.HasIndex(auditLog => auditLog.UserId);
        builder.HasIndex(auditLog => auditLog.ActionType);
        builder.HasIndex(auditLog => auditLog.EntityType);
        builder.HasIndex(auditLog => auditLog.Source);
        builder.HasIndex(auditLog => auditLog.MessengerPlatform);
    }
}
