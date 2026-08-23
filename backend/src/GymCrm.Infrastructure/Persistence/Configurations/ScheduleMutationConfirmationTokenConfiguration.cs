using GymCrm.Domain.Schedule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ScheduleMutationConfirmationTokenConfiguration : IEntityTypeConfiguration<ScheduleMutationConfirmationToken>
{
    public void Configure(EntityTypeBuilder<ScheduleMutationConfirmationToken> builder)
    {
        builder.HasKey(token => token.Id);

        builder.Property(token => token.TokenHash)
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(token => token.Purpose)
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(token => token.PayloadHash)
            .HasMaxLength(128)
            .IsRequired();
        builder.Property(token => token.PayloadJson)
            .HasColumnType("jsonb")
            .IsRequired();
        builder.Property(token => token.ExpiresAt).IsRequired();
        builder.Property(token => token.CreatedAt).IsRequired();

        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => new { token.ActorUserId, token.Purpose, token.ExpiresAt });
    }
}
