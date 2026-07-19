using GymCrm.Domain.Attendance;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Bot;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Persistence;

public sealed class GymCrmDbContext(DbContextOptions<GymCrmDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Hall> Halls => Set<Hall>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientContact> ClientContacts => Set<ClientContact>();
    public DbSet<ClientMembership> ClientMemberships => Set<ClientMembership>();
    public DbSet<ClientMembershipSale> ClientMembershipSales => Set<ClientMembershipSale>();
    public DbSet<ClientMembershipRefund> ClientMembershipRefunds => Set<ClientMembershipRefund>();
    public DbSet<ClientBranchAssignment> ClientBranchAssignments => Set<ClientBranchAssignment>();
    public DbSet<TrainingGroup> TrainingGroups => Set<TrainingGroup>();
    public DbSet<GroupType> GroupTypes => Set<GroupType>();
    public DbSet<ClientGroup> ClientGroups => Set<ClientGroup>();
    public DbSet<ClientGroupAssignment> ClientGroupAssignments => Set<ClientGroupAssignment>();
    public DbSet<GroupTrainer> GroupTrainers => Set<GroupTrainer>();
    public DbSet<GroupTrainerAssignment> GroupTrainerAssignments => Set<GroupTrainerAssignment>();
    public DbSet<Attendance> Attendance => Set<Attendance>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<BotIdempotencyRecord> BotIdempotencyRecords => Set<BotIdempotencyRecord>();
    public DbSet<ClientMessengerAccount> ClientMessengerAccounts => Set<ClientMessengerAccount>();
    public DbSet<ClientMessengerLinkToken> ClientMessengerLinkTokens => Set<ClientMessengerLinkToken>();
    public DbSet<ClientMessengerMessage> ClientMessengerMessages => Set<ClientMessengerMessage>();
    public DbSet<ClientMessengerReadState> ClientMessengerReadStates => Set<ClientMessengerReadState>();
    public DbSet<ClientTelegramPollState> ClientTelegramPollStates => Set<ClientTelegramPollState>();
    public DbSet<MembershipCatalogItem> MembershipCatalogItems => Set<MembershipCatalogItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GymCrmDbContext).Assembly);
    }
}
