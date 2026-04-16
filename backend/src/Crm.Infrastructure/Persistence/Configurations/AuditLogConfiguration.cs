using Crm.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(auditLog => auditLog.Id);

        builder.Property(auditLog => auditLog.ActionType)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(auditLog => auditLog.EntityType)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(auditLog => auditLog.EntityId)
            .HasMaxLength(128);

        builder.Property(auditLog => auditLog.Description)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(auditLog => auditLog.OldValueJson)
            .HasColumnType("jsonb");

        builder.Property(auditLog => auditLog.NewValueJson)
            .HasColumnType("jsonb");

        builder.Property(auditLog => auditLog.CreatedAt).IsRequired();

        builder.HasIndex(auditLog => auditLog.CreatedAt);
        builder.HasIndex(auditLog => auditLog.UserId);
        builder.HasIndex(auditLog => auditLog.ActionType);
        builder.HasIndex(auditLog => auditLog.EntityType);
    }
}
