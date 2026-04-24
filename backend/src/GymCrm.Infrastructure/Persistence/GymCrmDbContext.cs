using GymCrm.Domain.Attendance;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Bot;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Persistence;

public sealed class GymCrmDbContext(DbContextOptions<GymCrmDbContext> options) : DbContext(options)
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
    public DbSet<BotIdempotencyRecord> BotIdempotencyRecords => Set<BotIdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GymCrmDbContext).Assembly);
    }
}
