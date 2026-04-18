using Crm.Domain.Clients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Crm.Infrastructure.Persistence.Configurations;

internal sealed class ClientContactConfiguration : IEntityTypeConfiguration<ClientContact>
{
    private const int TypeMaxLength = 64;
    private const int FullNameMaxLength = 256;
    private const int PhoneMaxLength = 32;

    public void Configure(EntityTypeBuilder<ClientContact> builder)
    {
        builder.HasKey(contact => contact.Id);

        builder.Property(contact => contact.Type)
            .HasMaxLength(TypeMaxLength)
            .IsRequired();

        builder.Property(contact => contact.FullName)
            .HasMaxLength(FullNameMaxLength)
            .IsRequired();

        builder.Property(contact => contact.Phone)
            .HasMaxLength(PhoneMaxLength)
            .IsRequired();
    }
}
