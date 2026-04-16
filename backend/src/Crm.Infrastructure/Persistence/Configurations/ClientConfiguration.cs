using Crm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Clients_PhotoSizeBytes_NonNegative",
            "\"PhotoSizeBytes\" IS NULL OR \"PhotoSizeBytes\" >= 0"));

        builder.HasKey(client => client.Id);

        builder.Property(client => client.LastName).HasMaxLength(128);
        builder.Property(client => client.FirstName).HasMaxLength(128);
        builder.Property(client => client.MiddleName).HasMaxLength(128);

        builder.Property(client => client.Phone)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(client => client.PhotoPath).HasMaxLength(512);
        builder.Property(client => client.PhotoContentType).HasMaxLength(128);

        builder.Property(client => client.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(client => client.CreatedAt).IsRequired();
        builder.Property(client => client.UpdatedAt).IsRequired();

        builder.HasIndex(client => client.LastName);
        builder.HasIndex(client => client.FirstName);
        builder.HasIndex(client => client.Phone);
        builder.HasIndex(client => client.Status);

        builder.HasMany(client => client.Contacts)
            .WithOne(contact => contact.Client)
            .HasForeignKey(contact => contact.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(client => client.Memberships)
            .WithOne(membership => membership.Client)
            .HasForeignKey(membership => membership.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(client => client.Groups)
            .WithOne(clientGroup => clientGroup.Client)
            .HasForeignKey(clientGroup => clientGroup.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(client => client.AttendanceEntries)
            .WithOne(attendance => attendance.Client)
            .HasForeignKey(attendance => attendance.ClientId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ClientContactConfiguration : IEntityTypeConfiguration<ClientContact>
{
    public void Configure(EntityTypeBuilder<ClientContact> builder)
    {
        builder.HasKey(contact => contact.Id);

        builder.Property(contact => contact.Type)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(contact => contact.FullName)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(contact => contact.Phone)
            .HasMaxLength(32)
            .IsRequired();
    }
}

internal sealed class ClientMembershipConfiguration : IEntityTypeConfiguration<ClientMembership>
{
    public void Configure(EntityTypeBuilder<ClientMembership> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_ClientMemberships_PaymentAmount_NonNegative",
            "\"PaymentAmount\" >= 0"));

        builder.HasKey(membership => membership.Id);

        builder.Property(membership => membership.MembershipType)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(membership => membership.PaymentAmount)
            .HasPrecision(10, 2)
            .IsRequired();

        builder.Property(membership => membership.ChangeReason)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(membership => membership.ValidFrom).IsRequired();
        builder.Property(membership => membership.CreatedAt).IsRequired();

        builder.HasIndex(membership => membership.ClientId);
        builder.HasIndex(membership => membership.ValidTo);
        builder.HasIndex(membership => membership.ExpirationDate);

        builder.HasIndex(membership => membership.ClientId)
            .IsUnique()
            .HasFilter("\"ValidTo\" IS NULL");
    }
}
