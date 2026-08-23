using GymCrm.Domain.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> builder)
    {
        builder.HasKey(attendance => attendance.Id);

        builder.Property(attendance => attendance.MarkedAt).IsRequired();
        builder.Property(attendance => attendance.UpdatedAt).IsRequired();

        builder.HasIndex(attendance => attendance.LessonOccurrenceId);
        builder.HasIndex(attendance => new { attendance.GroupId, attendance.TrainingDate });
        builder.HasIndex(attendance => attendance.SingleVisitMembershipSaleId);
        builder.HasIndex(attendance => attendance.SingleVisitWriteOffMembershipId);

        builder.HasOne(attendance => attendance.LessonOccurrence)
            .WithMany()
            .HasForeignKey(attendance => attendance.LessonOccurrenceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(attendance => attendance.SingleVisitMembershipSale)
            .WithMany()
            .HasForeignKey(attendance => attendance.SingleVisitMembershipSaleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(attendance => attendance.SingleVisitWriteOffMembership)
            .WithMany()
            .HasForeignKey(attendance => attendance.SingleVisitWriteOffMembershipId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(attendance => new
        {
            attendance.ClientId,
            attendance.LessonOccurrenceId
        })
            .IsUnique();
    }
}
