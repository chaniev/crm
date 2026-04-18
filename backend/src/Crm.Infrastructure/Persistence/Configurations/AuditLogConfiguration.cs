using Crm.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    private const int ActionTypeMaxLength = 128;
    private const int EntityTypeMaxLength = 128;
    private const int EntityIdMaxLength = 128;
    private const int DescriptionMaxLength = 2000;
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

        builder.Property(auditLog => auditLog.OldValueJson)
            .HasColumnType(JsonbColumnType);

        builder.Property(auditLog => auditLog.NewValueJson)
            .HasColumnType(JsonbColumnType);

        builder.Property(auditLog => auditLog.CreatedAt).IsRequired();

        builder.HasIndex(auditLog => auditLog.CreatedAt);
        builder.HasIndex(auditLog => auditLog.UserId);
        builder.HasIndex(auditLog => auditLog.ActionType);
        builder.HasIndex(auditLog => auditLog.EntityType);
    }
}
