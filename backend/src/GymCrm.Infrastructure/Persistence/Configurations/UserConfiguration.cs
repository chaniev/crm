using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    private const int FullNameMaxLength = 256;
    private const int LoginMaxLength = 128;
    private const int PasswordHashMaxLength = 512;
    private const int RoleMaxLength = 32;
    private const int MessengerPlatformMaxLength = 32;
    private const int MessengerPlatformUserIdMaxLength = 128;
    private const string MessengerIdentityIndexFilter =
        "\"MessengerPlatform\" IS NOT NULL AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> ''";
    private const string MessengerIdentityConstraint =
        "(\"MessengerPlatform\" IS NULL AND (\"MessengerPlatformUserId\" IS NULL OR btrim(\"MessengerPlatformUserId\") = '')) " +
        "OR (\"MessengerPlatform\" = 'Telegram' AND \"MessengerPlatformUserId\" IS NOT NULL AND btrim(\"MessengerPlatformUserId\") <> '')";

    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(user => user.Id);

        builder.ToTable(tableBuilder =>
            tableBuilder.HasCheckConstraint(
                "CK_Users_MessengerIdentity_Consistency",
                MessengerIdentityConstraint));

        builder.Property(user => user.FullName)
            .HasMaxLength(FullNameMaxLength)
            .IsRequired();

        builder.Property(user => user.Login)
            .HasMaxLength(LoginMaxLength)
            .IsRequired();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(PasswordHashMaxLength)
            .IsRequired();

        builder.Property(user => user.Role)
            .HasConversion<string>()
            .HasMaxLength(RoleMaxLength)
            .IsRequired();

        builder.Property(user => user.MessengerPlatform)
            .HasConversion<string>()
            .HasMaxLength(MessengerPlatformMaxLength);

        builder.Property(user => user.MessengerPlatformUserId)
            .HasMaxLength(MessengerPlatformUserIdMaxLength);

        builder.Property(user => user.CreatedAt).IsRequired();
        builder.Property(user => user.UpdatedAt).IsRequired();

        builder.HasIndex(user => user.Login).IsUnique();

        builder.HasIndex(user => new { user.MessengerPlatform, user.MessengerPlatformUserId })
            .IsUnique()
            .HasFilter(MessengerIdentityIndexFilter);

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
