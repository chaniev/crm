using Crm.Domain.Attendance;
using Crm.Domain.Audit;
using Crm.Domain.Clients;
using Crm.Domain.Groups;
using Crm.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Crm.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientContact> ClientContacts => Set<ClientContact>();
    public DbSet<ClientMembership> ClientMemberships => Set<ClientMembership>();
    public DbSet<TrainingGroup> TrainingGroups => Set<TrainingGroup>();
    public DbSet<ClientGroup> ClientGroups => Set<ClientGroup>();
    public DbSet<GroupTrainer> GroupTrainers => Set<GroupTrainer>();
    public DbSet<Attendance> Attendance => Set<Attendance>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CrmDbContext).Assembly);
    }
}
