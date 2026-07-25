using GymCrm.Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymCrm.Infrastructure.Persistence.Configurations;

internal sealed class AdministratorAttendanceGroupGrantConfiguration : IEntityTypeConfiguration<AdministratorAttendanceGroupGrant>
{
    public void Configure(EntityTypeBuilder<AdministratorAttendanceGroupGrant> builder)
    {
        builder.HasKey(grant => new { grant.AdministratorId, grant.GroupId });

        builder.Property(grant => grant.GrantedAt).IsRequired();

        builder.HasIndex(grant => grant.GroupId);
        builder.HasIndex(grant => grant.BranchId);

        builder.HasOne(grant => grant.Administrator)
            .WithMany(user => user.AdministratorAttendanceGroupGrants)
            .HasForeignKey(grant => grant.AdministratorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(grant => grant.Group)
            .WithMany(group => group.AdministratorAttendanceGroupGrants)
            .HasForeignKey(grant => grant.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(grant => grant.Branch)
            .WithMany()
            .HasForeignKey(grant => grant.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(grant => grant.GrantedByUser)
            .WithMany(user => user.GrantedAdministratorAttendanceGroupGrants)
            .HasForeignKey(grant => grant.GrantedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
