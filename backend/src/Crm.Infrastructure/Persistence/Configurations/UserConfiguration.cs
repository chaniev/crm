using Crm.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(user => user.Id);

        builder.Property(user => user.FullName)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(user => user.Login)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(user => user.Role)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(user => user.CreatedAt).IsRequired();
        builder.Property(user => user.UpdatedAt).IsRequired();

        builder.HasIndex(user => user.Login).IsUnique();

        builder.HasMany(user => user.AssignedGroups)
            .WithOne(groupTrainer => groupTrainer.Trainer)
            .HasForeignKey(groupTrainer => groupTrainer.TrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(user => user.MembershipPayments)
            .WithOne(membership => membership.PaidByUser)
            .HasForeignKey(membership => membership.PaidByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(user => user.MembershipChanges)
            .WithOne(membership => membership.ChangedByUser)
            .HasForeignKey(membership => membership.ChangedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(user => user.AttendanceMarks)
            .WithOne(attendance => attendance.MarkedByUser)
            .HasForeignKey(attendance => attendance.MarkedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(user => user.AuditLogs)
            .WithOne(auditLog => auditLog.User)
            .HasForeignKey(auditLog => auditLog.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
