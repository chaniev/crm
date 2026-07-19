using GymCrm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class ClientMissedTrainingAcknowledgementConfiguration
    : IEntityTypeConfiguration<ClientMissedTrainingAcknowledgement>
{
    public void Configure(EntityTypeBuilder<ClientMissedTrainingAcknowledgement> builder)
    {
        builder.HasKey(acknowledgement => acknowledgement.Id);
        builder.Property(acknowledgement => acknowledgement.LastTrainingDate).IsRequired();
        builder.Property(acknowledgement => acknowledgement.LastTrainingStartTime).IsRequired();
        builder.Property(acknowledgement => acknowledgement.AcknowledgedAt)
            .IsRequired()
            .IsConcurrencyToken();
        builder.HasIndex(acknowledgement => acknowledgement.ClientId).IsUnique();

        builder.HasOne(acknowledgement => acknowledgement.Client)
            .WithMany(client => client.MissedTrainingAcknowledgements)
            .HasForeignKey(acknowledgement => acknowledgement.ClientId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(acknowledgement => acknowledgement.LastAttendance)
            .WithMany()
            .HasForeignKey(acknowledgement => acknowledgement.LastAttendanceId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(acknowledgement => acknowledgement.AcknowledgedByUser)
            .WithMany()
            .HasForeignKey(acknowledgement => acknowledgement.AcknowledgedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
