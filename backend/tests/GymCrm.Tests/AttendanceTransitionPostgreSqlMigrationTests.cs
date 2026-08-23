using GymCrm.Application.Attendance;
using GymCrm.Domain.Attendance;
using GymCrm.Domain.Branches;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.AttendanceFeatures;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GymCrm.Tests;

public sealed class AttendanceTransitionPostgreSqlMigrationTests
{
    [Fact]
    public async Task PostgreSql_additive_transition_keeps_sql_null_and_final_guard_blocks_required_identity()
    {
        await using var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase($"gym_crm_attendance_transition_{Guid.NewGuid():N}")
            .WithUsername("gym_crm")
            .WithPassword("gym_crm")
            .Build();
        await postgreSql.StartAsync();

        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(postgreSql.GetConnectionString())
            .Options;

        await using var dbContext = new GymCrmDbContext(options);
        var migrator = dbContext.GetInfrastructure().GetRequiredService<IMigrator>();
        await migrator.MigrateAsync("20260823162000_AddAttendanceOccurrenceTransition");

        await AssertColumnNullableAsync(postgreSql.GetConnectionString(), "Attendance", "LessonOccurrenceId", expectedNullable: true);

        var seeded = await SeedMinimumAttendanceGraphAsync(dbContext);
        await InsertAttendanceWithSqlNullOccurrenceAsync(postgreSql.GetConnectionString(), seeded);

        var exception = await Assert.ThrowsAnyAsync<Exception>(() =>
            migrator.MigrateAsync("20260823163000_RequireAttendanceOccurrenceIdentity"));
        Assert.Contains("attendance-transition-unresolved", exception.ToString(), StringComparison.Ordinal);
        Assert.Contains("LessonOccurrenceId contains NULL rows", exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task PostgreSql_lesson_occurrence_trainer_substitution_allows_one_active_replacement()
    {
        await using var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase($"gym_crm_lesson_substitution_{Guid.NewGuid():N}")
            .WithUsername("gym_crm")
            .WithPassword("gym_crm")
            .Build();
        await postgreSql.StartAsync();

        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(postgreSql.GetConnectionString())
            .Options;

        await using var dbContext = new GymCrmDbContext(options);
        await dbContext.Database.MigrateAsync();
        var seeded = await SeedLessonOccurrenceSubstitutionGraphAsync(dbContext);

        dbContext.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            LessonOccurrenceId = seeded.LessonOccurrenceId,
            ReplacedTrainerId = seeded.ReplacedTrainerId,
            SubstituteTrainerId = seeded.FirstSubstituteTrainerId,
            CreatedByUserId = seeded.OperatorId,
            SourceGroupTrainerSubstitutionId = seeded.SourceGroupTrainerSubstitutionId,
            CreatedAt = seeded.Timestamp,
            UpdatedAt = seeded.Timestamp
        });
        await dbContext.SaveChangesAsync();

        dbContext.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            LessonOccurrenceId = seeded.LessonOccurrenceId,
            ReplacedTrainerId = seeded.ReplacedTrainerId,
            SubstituteTrainerId = seeded.SecondSubstituteTrainerId,
            CreatedByUserId = seeded.OperatorId,
            CreatedAt = seeded.Timestamp,
            UpdatedAt = seeded.Timestamp
        });
        var conflict = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        Assert.Contains("LessonOccurrenceTrainerSubstitutions", conflict.ToString(), StringComparison.Ordinal);

        dbContext.ChangeTracker.Clear();
        var stored = await dbContext.LessonOccurrenceTrainerSubstitutions.SingleAsync();
        stored.CancelledAt = seeded.Timestamp.AddMinutes(1);
        stored.CancelledByUserId = seeded.OperatorId;
        stored.UpdatedByUserId = seeded.OperatorId;
        stored.UpdatedAt = seeded.Timestamp.AddMinutes(1);
        await dbContext.SaveChangesAsync();

        dbContext.LessonOccurrenceTrainerSubstitutions.Add(new LessonOccurrenceTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            LessonOccurrenceId = seeded.LessonOccurrenceId,
            ReplacedTrainerId = seeded.ReplacedTrainerId,
            SubstituteTrainerId = seeded.SecondSubstituteTrainerId,
            CreatedByUserId = seeded.OperatorId,
            CreatedAt = seeded.Timestamp.AddMinutes(2),
            UpdatedAt = seeded.Timestamp.AddMinutes(2)
        });
        await dbContext.SaveChangesAsync();

        Assert.Equal(2, await dbContext.LessonOccurrenceTrainerSubstitutions.CountAsync());
        Assert.Single(await dbContext.LessonOccurrenceTrainerSubstitutions.Where(item => item.CancelledAt == null).ToArrayAsync());
    }

    [Fact]
    public async Task PostgreSql_manual_trainer_substitution_report_resolution_is_audited_and_idempotent()
    {
        await using var postgreSql = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase($"gym_crm_lesson_substitution_repair_{Guid.NewGuid():N}")
            .WithUsername("gym_crm")
            .WithPassword("gym_crm")
            .Build();
        await postgreSql.StartAsync();

        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql(postgreSql.GetConnectionString())
            .Options;

        await using var dbContext = new GymCrmDbContext(options);
        await dbContext.Database.MigrateAsync();
        var seeded = await SeedLessonOccurrenceSubstitutionGraphAsync(dbContext);
        var run = new AttendanceTransitionRun
        {
            Id = Guid.NewGuid(),
            CutoverDate = seeded.LessonDate,
            SourceSchemaVersion = "pg-manual-substitution",
            Status = AttendanceTransitionRunStatus.Blocked,
            CreatedAt = seeded.Timestamp,
            UpdatedAt = seeded.Timestamp
        };
        var report = new AttendanceTransitionReportItem
        {
            Id = Guid.NewGuid(),
            RunId = run.Id,
            GroupId = seeded.GroupId,
            TrainingDate = seeded.LessonDate,
            AttendanceRowIdsJson = "[]",
            RowCount = 0,
            ReasonCode = "trainer-substitution-occurrence-ambiguous",
            ResolutionStatus = AttendanceTransitionResolutionStatus.Unresolved,
            CreatedAt = seeded.Timestamp,
            UpdatedAt = seeded.Timestamp
        };
        dbContext.AttendanceTransitionRuns.Add(run);
        dbContext.AttendanceTransitionReportItems.Add(report);
        await dbContext.SaveChangesAsync();
        var service = new AttendanceTransitionService(dbContext, TimeProvider.System);

        var result = await service.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                report.Id,
                seeded.OperatorId,
                seeded.LessonOccurrenceId,
                seeded.ReplacedTrainerId,
                seeded.FirstSubstituteTrainerId,
                seeded.SourceGroupTrainerSubstitutionId,
                "postgres repair"),
            CancellationToken.None);
        var replay = await service.ResolveTrainerSubstitutionReportItemAsync(
            new ResolveTrainerSubstitutionTransitionReportItemCommand(
                report.Id,
                seeded.OperatorId,
                seeded.LessonOccurrenceId,
                seeded.ReplacedTrainerId,
                seeded.FirstSubstituteTrainerId,
                seeded.SourceGroupTrainerSubstitutionId,
                "postgres repair"),
            CancellationToken.None);
        var activation = await service.ValidateActivationAsync(run.Id, CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.True(replay.Succeeded);
        Assert.True(activation.CanActivate);
        Assert.Single(await dbContext.LessonOccurrenceTrainerSubstitutions.ToArrayAsync());
        Assert.Single(await dbContext.AuditLogs.Where(log => log.ActionType == "AttendanceTransitionTrainerSubstitutionResolved").ToArrayAsync());
        var storedReport = await dbContext.AttendanceTransitionReportItems.SingleAsync(item => item.Id == report.Id);
        Assert.Equal(AttendanceTransitionResolutionStatus.Resolved, storedReport.ResolutionStatus);
        Assert.Equal("TrainerSubstitutionManual", storedReport.ResolutionKind);
    }

    private static async Task<SeededAttendanceTransitionGraph> SeedMinimumAttendanceGraphAsync(GymCrmDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Transition Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Attendance Transition Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Attendance Transition Type",
            CreatedAt = now,
            UpdatedAt = now
        };
        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "Attendance Transition Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var user = new User
        {
            Id = Guid.NewGuid(),
            Login = "attendance-transition-user",
            FullName = "Attendance Transition User",
            PasswordHash = "test-hash",
            Role = UserRole.HeadCoach,
            IsActive = true,
            MustChangePassword = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var client = new Client
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            LastName = "Transition",
            FirstName = "Client",
            Phone = "+79990009999",
            Status = ClientStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Branches.Add(branch);
        dbContext.Halls.Add(hall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.Add(group);
        dbContext.Users.Add(user);
        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync();

        return new SeededAttendanceTransitionGraph(client.Id, group.Id, user.Id, DateOnly.FromDateTime(now.UtcDateTime), now);
    }

    private static async Task<SeededLessonOccurrenceSubstitutionGraph> SeedLessonOccurrenceSubstitutionGraphAsync(
        GymCrmDbContext dbContext)
    {
        var now = DateTimeOffset.UtcNow;
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = "Lesson Substitution Branch",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            Name = "Lesson Substitution Hall",
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = "Lesson Substitution Type",
            CreatedAt = now,
            UpdatedAt = now
        };
        var group = new TrainingGroup
        {
            Id = Guid.NewGuid(),
            BranchId = branch.Id,
            HallId = hall.Id,
            GroupTypeId = groupType.Id,
            Name = "Lesson Substitution Group",
            TrainingStartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Weekdays = [1],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        var operatorUser = CreateUser("lesson-substitution-operator", UserRole.HeadCoach, now);
        var replacedTrainer = CreateUser("lesson-substitution-replaced", UserRole.Coach, now);
        var firstSubstitute = CreateUser("lesson-substitution-substitute-1", UserRole.Coach, now);
        var secondSubstitute = CreateUser("lesson-substitution-substitute-2", UserRole.Coach, now);
        var lessonOccurrence = new LessonOccurrence
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            HallId = hall.Id,
            LessonDate = new DateOnly(2026, 8, 24),
            StartTime = new TimeOnly(10, 0),
            DurationMinutes = 60,
            Status = LessonOccurrenceStatus.Scheduled,
            SourceKind = LessonOccurrenceSourceKind.LegacyAttendance,
            CreatedAt = now,
            UpdatedAt = now
        };
        var sourceSubstitution = new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            SubstituteTrainerId = firstSubstitute.Id,
            StartsOn = lessonOccurrence.LessonDate,
            EndsOn = lessonOccurrence.LessonDate,
            CreatedByUserId = operatorUser.Id,
            CreatedAt = now,
            UpdatedAt = now
        };
        var assignment = new GroupTrainerAssignment
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            TrainerId = replacedTrainer.Id,
            ValidFrom = lessonOccurrence.LessonDate.AddDays(-7),
            CreatedByUserId = operatorUser.Id,
            CreatedAt = now
        };

        dbContext.Branches.Add(branch);
        dbContext.Halls.Add(hall);
        dbContext.GroupTypes.Add(groupType);
        dbContext.TrainingGroups.Add(group);
        dbContext.Users.AddRange(operatorUser, replacedTrainer, firstSubstitute, secondSubstitute);
        dbContext.LessonOccurrences.Add(lessonOccurrence);
        dbContext.GroupTrainerSubstitutions.Add(sourceSubstitution);
        dbContext.GroupTrainerAssignments.Add(assignment);
        await dbContext.SaveChangesAsync();

        return new SeededLessonOccurrenceSubstitutionGraph(
            group.Id,
            lessonOccurrence.Id,
            lessonOccurrence.LessonDate,
            replacedTrainer.Id,
            firstSubstitute.Id,
            secondSubstitute.Id,
            operatorUser.Id,
            sourceSubstitution.Id,
            now);
    }

    private static User CreateUser(string login, UserRole role, DateTimeOffset now)
    {
        return new User
        {
            Id = Guid.NewGuid(),
            Login = login,
            FullName = login,
            PasswordHash = "test-hash",
            Role = role,
            IsActive = true,
            MustChangePassword = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static async Task InsertAttendanceWithSqlNullOccurrenceAsync(
        string connectionString,
        SeededAttendanceTransitionGraph seeded)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO "Attendance" (
                "Id", "ClientId", "GroupId", "TrainingDate", "IsPresent",
                "MarkedByUserId", "MarkedAt", "UpdatedAt", "LessonOccurrenceId")
            VALUES (
                @id, @clientId, @groupId, @trainingDate, true,
                @markedByUserId, @markedAt, @updatedAt, NULL)
            """;
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("clientId", seeded.ClientId);
        command.Parameters.AddWithValue("groupId", seeded.GroupId);
        command.Parameters.AddWithValue("trainingDate", seeded.TrainingDate);
        command.Parameters.AddWithValue("markedByUserId", seeded.UserId);
        command.Parameters.AddWithValue("markedAt", seeded.Timestamp);
        command.Parameters.AddWithValue("updatedAt", seeded.Timestamp);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task AssertColumnNullableAsync(
        string connectionString,
        string tableName,
        string columnName,
        bool expectedNullable)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = @tableName AND column_name = @columnName
            """;
        command.Parameters.AddWithValue("tableName", tableName);
        command.Parameters.AddWithValue("columnName", columnName);
        var isNullable = (string?)await command.ExecuteScalarAsync();
        Assert.Equal(expectedNullable ? "YES" : "NO", isNullable);
    }

    private sealed record SeededAttendanceTransitionGraph(
        Guid ClientId,
        Guid GroupId,
        Guid UserId,
        DateOnly TrainingDate,
        DateTimeOffset Timestamp);

    private sealed record SeededLessonOccurrenceSubstitutionGraph(
        Guid GroupId,
        Guid LessonOccurrenceId,
        DateOnly LessonDate,
        Guid ReplacedTrainerId,
        Guid FirstSubstituteTrainerId,
        Guid SecondSubstituteTrainerId,
        Guid OperatorId,
        Guid SourceGroupTrainerSubstitutionId,
        DateTimeOffset Timestamp);
}
