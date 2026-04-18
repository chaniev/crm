using Crm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    private const int NameMaxLength = 128;
    private const int PhoneMaxLength = 32;
    private const int PhotoPathMaxLength = 512;
    private const int PhotoContentTypeMaxLength = 128;
    private const int StatusMaxLength = 32;
    private const string PhotoSizeBytesNonNegativeConstraintName = "CK_Clients_PhotoSizeBytes_NonNegative";
    private const string PhotoSizeBytesNonNegativeConstraintSql = "\"PhotoSizeBytes\" IS NULL OR \"PhotoSizeBytes\" >= 0";

    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint(
            PhotoSizeBytesNonNegativeConstraintName,
            PhotoSizeBytesNonNegativeConstraintSql));

        builder.HasKey(client => client.Id);

        builder.Property(client => client.LastName).HasMaxLength(NameMaxLength);
        builder.Property(client => client.FirstName).HasMaxLength(NameMaxLength);
        builder.Property(client => client.MiddleName).HasMaxLength(NameMaxLength);

        builder.Property(client => client.Phone)
            .HasMaxLength(PhoneMaxLength)
            .IsRequired();

        builder.Property(client => client.PhotoPath).HasMaxLength(PhotoPathMaxLength);
        builder.Property(client => client.PhotoContentType).HasMaxLength(PhotoContentTypeMaxLength);

        builder.Property(client => client.Status)
            .HasConversion<string>()
            .HasMaxLength(StatusMaxLength)
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
