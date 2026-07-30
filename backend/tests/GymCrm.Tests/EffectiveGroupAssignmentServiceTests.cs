using GymCrm.Application.Attendance;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Authorization;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Tests;

public class EffectiveGroupAssignmentServiceTests
{
    private static readonly DateOnly BusinessDate = new(2026, 7, 25);

    [Fact]
    public async Task List_effective_assigned_group_ids_returns_permanent_and_active_temporary_assignments_only()
    {
        var trainerId = Guid.NewGuid();
        var permanentGroupId = Guid.NewGuid();
        var activeStartsTodayGroupId = Guid.NewGuid();
        var activeEndsTodayGroupId = Guid.NewGuid();
        var deduplicatedGroupId = Guid.NewGuid();
        var futureGroupId = Guid.NewGuid();
        var expiredGroupId = Guid.NewGuid();
        var cancelledGroupId = Guid.NewGuid();

        await using var dbContext = CreateDbContext();
        dbContext.GroupTrainers.AddRange(
            new GroupTrainer { GroupId = permanentGroupId, TrainerId = trainerId },
            new GroupTrainer { GroupId = deduplicatedGroupId, TrainerId = trainerId });
        dbContext.GroupTrainerSubstitutions.AddRange(
            CreateSubstitution(activeStartsTodayGroupId, trainerId, BusinessDate, BusinessDate.AddDays(2)),
            CreateSubstitution(activeEndsTodayGroupId, trainerId, BusinessDate.AddDays(-2), BusinessDate),
            CreateSubstitution(deduplicatedGroupId, trainerId, BusinessDate.AddDays(-1), BusinessDate.AddDays(1)),
            CreateSubstitution(futureGroupId, trainerId, BusinessDate.AddDays(1), BusinessDate.AddDays(2)),
            CreateSubstitution(expiredGroupId, trainerId, BusinessDate.AddDays(-2), BusinessDate.AddDays(-1)),
            CreateSubstitution(cancelledGroupId, trainerId, BusinessDate.AddDays(-1), BusinessDate.AddDays(1), cancelled: true));
        await dbContext.SaveChangesAsync();

        var service = new EffectiveGroupAssignmentService(dbContext, new FixedBusinessDateProvider(BusinessDate));

        var groupIds = await service.ListEffectiveAssignedGroupIdsAsync(trainerId, CancellationToken.None);

        Assert.Equal(
            new[] { activeEndsTodayGroupId, activeStartsTodayGroupId, deduplicatedGroupId, permanentGroupId }
                .OrderBy(groupId => groupId)
                .ToArray(),
            groupIds);
    }

    [Fact]
    public async Task List_effective_assigned_group_ids_returns_empty_for_empty_or_unassigned_trainer()
    {
        await using var dbContext = CreateDbContext();
        dbContext.GroupTrainers.Add(new GroupTrainer
        {
            GroupId = Guid.NewGuid(),
            TrainerId = Guid.NewGuid()
        });
        dbContext.GroupTrainerSubstitutions.Add(CreateSubstitution(
            Guid.NewGuid(),
            Guid.NewGuid(),
            BusinessDate,
            BusinessDate));
        await dbContext.SaveChangesAsync();

        var service = new EffectiveGroupAssignmentService(dbContext, new FixedBusinessDateProvider(BusinessDate));

        Assert.Empty(await service.ListEffectiveAssignedGroupIdsAsync(Guid.Empty, CancellationToken.None));
        Assert.Empty(await service.ListEffectiveAssignedGroupIdsAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Theory]
    [InlineData("Permanent", true)]
    [InlineData("ActiveTemporary", true)]
    [InlineData("FutureTemporary", false)]
    [InlineData("ExpiredTemporary", false)]
    [InlineData("CancelledTemporary", false)]
    [InlineData("EmptyTrainer", false)]
    [InlineData("EmptyGroup", false)]
    public async Task Has_effective_assignment_matches_permanent_and_active_temporary_scope(
        string scenario,
        bool expected)
    {
        var trainerId = Guid.NewGuid();
        var groupId = Guid.NewGuid();

        await using var dbContext = CreateDbContext();
        switch (scenario)
        {
            case "Permanent":
                dbContext.GroupTrainers.Add(new GroupTrainer { GroupId = groupId, TrainerId = trainerId });
                break;
            case "ActiveTemporary":
                dbContext.GroupTrainerSubstitutions.Add(CreateSubstitution(
                    groupId,
                    trainerId,
                    BusinessDate,
                    BusinessDate));
                break;
            case "FutureTemporary":
                dbContext.GroupTrainerSubstitutions.Add(CreateSubstitution(
                    groupId,
                    trainerId,
                    BusinessDate.AddDays(1),
                    BusinessDate.AddDays(2)));
                break;
            case "ExpiredTemporary":
                dbContext.GroupTrainerSubstitutions.Add(CreateSubstitution(
                    groupId,
                    trainerId,
                    BusinessDate.AddDays(-2),
                    BusinessDate.AddDays(-1)));
                break;
            case "CancelledTemporary":
                dbContext.GroupTrainerSubstitutions.Add(CreateSubstitution(
                    groupId,
                    trainerId,
                    BusinessDate,
                    BusinessDate,
                    cancelled: true));
                break;
        }

        await dbContext.SaveChangesAsync();

        var service = new EffectiveGroupAssignmentService(dbContext, new FixedBusinessDateProvider(BusinessDate));
        var actualTrainerId = scenario == "EmptyTrainer" ? Guid.Empty : trainerId;
        var actualGroupId = scenario == "EmptyGroup" ? Guid.Empty : groupId;

        Assert.Equal(
            expected,
            await service.HasEffectiveAssignmentAsync(actualTrainerId, actualGroupId, CancellationToken.None));
    }

    private static GymCrmDbContext CreateDbContext()
    {
        return new GymCrmDbContext(new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseInMemoryDatabase($"gym-crm-effective-assignment-{Guid.NewGuid():N}")
            .Options);
    }

    private static GroupTrainerSubstitution CreateSubstitution(
        Guid groupId,
        Guid substituteTrainerId,
        DateOnly startsOn,
        DateOnly endsOn,
        bool cancelled = false)
    {
        var now = new DateTimeOffset(2026, 7, 20, 10, 0, 0, TimeSpan.Zero);
        return new GroupTrainerSubstitution
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            SubstituteTrainerId = substituteTrainerId,
            StartsOn = startsOn,
            EndsOn = endsOn,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now,
            CancelledAt = cancelled ? now.AddHours(1) : null
        };
    }

    private sealed class FixedBusinessDateProvider(DateOnly today) : IBusinessDateProvider
    {
        public DateOnly Today { get; } = today;
    }
}
