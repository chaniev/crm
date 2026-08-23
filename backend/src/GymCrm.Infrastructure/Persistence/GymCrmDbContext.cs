using GymCrm.Domain.Attendance;
using GymCrm.Domain.Audit;
using GymCrm.Domain.Bot;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Messenger;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Persistence;

public sealed class GymCrmDbContext(DbContextOptions<GymCrmDbContext> options) : DbContext(options)
{
    public const string ClientMembershipIdempotencyActorKeyIndexName =
        "UX_ClientMembershipIdempotency_Actor_Key";

    public DbSet<User> Users => Set<User>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Hall> Halls => Set<Hall>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientContact> ClientContacts => Set<ClientContact>();
    public DbSet<ClientMembership> ClientMemberships => Set<ClientMembership>();
    public DbSet<ClientMembershipTargetGroup> ClientMembershipTargetGroups => Set<ClientMembershipTargetGroup>();
    public DbSet<ClientMembershipIdempotencyRecord> ClientMembershipIdempotencyRecords => Set<ClientMembershipIdempotencyRecord>();
    public DbSet<ClientMembershipSale> ClientMembershipSales => Set<ClientMembershipSale>();
    public DbSet<ClientMembershipSaleTargetSnapshot> ClientMembershipSaleTargetSnapshots => Set<ClientMembershipSaleTargetSnapshot>();
    public DbSet<ClientMembershipRefund> ClientMembershipRefunds => Set<ClientMembershipRefund>();
    public DbSet<ClientMembershipRefundTargetSnapshot> ClientMembershipRefundTargetSnapshots => Set<ClientMembershipRefundTargetSnapshot>();
    public DbSet<ClientBranchAssignment> ClientBranchAssignments => Set<ClientBranchAssignment>();
    public DbSet<TrainingGroup> TrainingGroups => Set<TrainingGroup>();
    public DbSet<LessonSeries> LessonSeries => Set<LessonSeries>();
    public DbSet<LessonScheduleRuleVersion> LessonScheduleRuleVersions => Set<LessonScheduleRuleVersion>();
    public DbSet<LessonScheduleSlot> LessonScheduleSlots => Set<LessonScheduleSlot>();
    public DbSet<LessonOccurrence> LessonOccurrences => Set<LessonOccurrence>();
    public DbSet<LessonOccurrenceTrainerSubstitution> LessonOccurrenceTrainerSubstitutions => Set<LessonOccurrenceTrainerSubstitution>();
    public DbSet<ScheduleMutationConfirmationToken> ScheduleMutationConfirmationTokens => Set<ScheduleMutationConfirmationToken>();
    public DbSet<AdministratorAttendanceGroupGrant> AdministratorAttendanceGroupGrants => Set<AdministratorAttendanceGroupGrant>();
    public DbSet<GroupType> GroupTypes => Set<GroupType>();
    public DbSet<ClientGroup> ClientGroups => Set<ClientGroup>();
    public DbSet<ClientGroupAssignment> ClientGroupAssignments => Set<ClientGroupAssignment>();
    public DbSet<GroupTrainer> GroupTrainers => Set<GroupTrainer>();
    public DbSet<GroupTrainerAssignment> GroupTrainerAssignments => Set<GroupTrainerAssignment>();
    public DbSet<GroupTrainerSubstitution> GroupTrainerSubstitutions => Set<GroupTrainerSubstitution>();
    public DbSet<Attendance> Attendance => Set<Attendance>();
    public DbSet<AttendanceTransitionRun> AttendanceTransitionRuns => Set<AttendanceTransitionRun>();
    public DbSet<AttendanceTransitionReportItem> AttendanceTransitionReportItems => Set<AttendanceTransitionReportItem>();
    public DbSet<AttendanceTransitionRowResolution> AttendanceTransitionRowResolutions => Set<AttendanceTransitionRowResolution>();
    public DbSet<AttendanceEntitlementTargetSnapshot> AttendanceEntitlementTargetSnapshots => Set<AttendanceEntitlementTargetSnapshot>();
    public DbSet<ClientMissedTrainingAcknowledgement> ClientMissedTrainingAcknowledgements => Set<ClientMissedTrainingAcknowledgement>();
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
