using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Schedule;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Scheduling;

internal sealed class ScheduleLessonReader(
    GymCrmDbContext dbContext,
    IAccessScopeService accessScopeService,
    IAttendanceDatePolicy attendanceDatePolicy) : IScheduleLessonReader
{
    public async Task<ScheduleReadResult> ReadAsync(User actor, ScheduleReadQuery query, CancellationToken cancellationToken)
    {
        var scopedSeries = await LoadScopedSeriesAsync(actor, query.From, query.To, dbContext, accessScopeService, cancellationToken);
        var filterOptions = BuildFilterOptions(scopedSeries);
        var series = scopedSeries.AsEnumerable();
        if (query.BranchId.HasValue) series = series.Where(item => item.Group.BranchId == query.BranchId.Value);
        if (query.HallId.HasValue) series = series.Where(item => item.RuleVersions.Any(version =>
            version.Slots.Any(slot => slot.HallId == query.HallId.Value)));
        if (query.GroupId.HasValue) series = series.Where(item => item.GroupId == query.GroupId.Value);
        if (query.GroupTypeId.HasValue) series = series.Where(item => item.Group.GroupTypeId == query.GroupTypeId.Value);

        var attendanceMarks = await LoadAttendanceMarkFactsAsync(dbContext, query.From, query.To, cancellationToken);
        var substituteIds = await LoadAccessibleSubstituteOccurrenceIdsAsync(dbContext, actor, query.From, query.To, cancellationToken);
        var standaloneIds = await LoadStandaloneOccurrenceIdsAsync(actor, query,
            scopedSeries.Select(item => item.GroupId).ToHashSet(), cancellationToken);
        var materialized = await LoadMaterializedOccurrencesAsync(dbContext,
            series.Select(item => item.GroupId).ToHashSet(), substituteIds.Concat(standaloneIds).ToHashSet(),
            query.From, query.To, cancellationToken);
        var lessons = ScheduleLessonProjector.Project(series, materialized, query.From, query.To,
                actor.Role, attendanceDatePolicy, attendanceMarks)
            .Select(lesson => lesson with { IsAccessibleThroughSubstitution = substituteIds.Contains(lesson.LessonOccurrenceId) })
            .ToArray();
        return new ScheduleReadResult(lessons, filterOptions);
    }

    private async Task<HashSet<Guid>> LoadStandaloneOccurrenceIdsAsync(
        User actor,
        ScheduleReadQuery request,
        IReadOnlySet<Guid> overlappingSeriesGroupIds,
        CancellationToken cancellationToken)
    {
        var scope = await accessScopeService.GetAccessScopeAsync(actor, cancellationToken);
        var accessibleGroupIds = scope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : scope.AttendanceScope.GroupIds.ToHashSet();

        // A one-off or moved lesson can outlive its series. Keep existing-series filters unchanged.
        var query = dbContext.LessonOccurrences.AsNoTracking()
            .Where(occurrence => !overlappingSeriesGroupIds.Contains(occurrence.GroupId) &&
                occurrence.LessonDate >= request.From && occurrence.LessonDate <= request.To);
        if (accessibleGroupIds is not null) query = query.Where(occurrence => accessibleGroupIds.Contains(occurrence.GroupId));
        if (request.BranchId.HasValue) query = query.Where(occurrence => occurrence.Group.BranchId == request.BranchId.Value);
        if (request.GroupId.HasValue) query = query.Where(occurrence => occurrence.GroupId == request.GroupId.Value);
        if (request.GroupTypeId.HasValue) query = query.Where(occurrence => occurrence.Group.GroupTypeId == request.GroupTypeId.Value);
        if (request.HallId.HasValue) query = query.Where(occurrence => occurrence.HallId == request.HallId.Value);
        return (await query.Select(occurrence => occurrence.Id).ToArrayAsync(cancellationToken)).ToHashSet();
    }

    public async Task<ScheduleLessonFacts?> FindRecurringAsync(User actor, Guid occurrenceId, DateOnly date, CancellationToken cancellationToken)
    {
        var series = await LoadScopedSeriesAsync(actor, date, date, dbContext, accessScopeService, cancellationToken);
        return ScheduleLessonProjector.Project(series, [], date, date, actor.Role, attendanceDatePolicy, new HashSet<Guid>())
            .SingleOrDefault(lesson => lesson.LessonOccurrenceId == occurrenceId);
    }

    private static async Task<List<LessonSeries>> LoadScopedSeriesAsync(
        User currentUser,
        DateOnly from,
        DateOnly to,
        GymCrmDbContext dbContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var accessScope = await accessScopeService.GetAccessScopeAsync(currentUser, cancellationToken);
        var accessibleGroupIds = accessScope.AttendanceScope.Kind == AttendanceScopeKind.Global
            ? null
            : accessScope.AttendanceScope.GroupIds.ToHashSet();

        var query = dbContext.LessonSeries
            .AsNoTracking()
            .Where(series =>
                series.StartsOn <= to &&
                (series.EndsOn == null || series.EndsOn >= from))
            .Include(series => series.Group)
                .ThenInclude(group => group.Branch)
            .Include(series => series.Group)
                .ThenInclude(group => group.GroupType)
            .Include(series => series.Group)
                .ThenInclude(group => group.TrainerAssignments)
                .ThenInclude(assignment => assignment.Trainer)
            .Include(series => series.RuleVersions)
                .ThenInclude(version => version.Slots)
                    .ThenInclude(slot => slot.Hall)
            .AsSplitQuery();
        if (accessibleGroupIds is not null)
        {
            query = query.Where(series => accessibleGroupIds.Contains(series.GroupId));
        }

        return await query
            .OrderBy(series => series.Group.Name)
            .ThenBy(series => series.GroupId)
            .ToListAsync(cancellationToken);
    }

    private static async Task<HashSet<Guid>> LoadAttendanceMarkFactsAsync(
        GymCrmDbContext dbContext,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        return (await dbContext.Attendance
                .AsNoTracking()
                .Where(attendance => attendance.TrainingDate >= from && attendance.TrainingDate <= to)
                .Select(attendance => attendance.LessonOccurrenceId)
                .Distinct()
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private static async Task<IReadOnlyList<LessonOccurrence>> LoadMaterializedOccurrencesAsync(
        GymCrmDbContext dbContext,
        IReadOnlySet<Guid> groupIds,
        IReadOnlySet<Guid> additionalOccurrenceIds,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        if (groupIds.Count == 0 && additionalOccurrenceIds.Count == 0)
        {
            return [];
        }

        return await dbContext.LessonOccurrences
            .AsNoTracking()
            .Where(occurrence =>
                (groupIds.Contains(occurrence.GroupId) || additionalOccurrenceIds.Contains(occurrence.Id)) &&
                ((occurrence.LessonDate >= from && occurrence.LessonDate <= to) ||
                    (occurrence.ProjectedDate != null &&
                        occurrence.ProjectedDate >= from &&
                        occurrence.ProjectedDate <= to)))
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.Branch)
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.GroupType)
            .Include(occurrence => occurrence.Group)
                .ThenInclude(group => group.TrainerAssignments)
                    .ThenInclude(assignment => assignment.Trainer)
            .Include(occurrence => occurrence.Hall)
            .Include(occurrence => occurrence.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.ReplacedTrainer)
            .Include(occurrence => occurrence.TrainerSubstitutions.Where(substitution => substitution.CancelledAt == null))
                .ThenInclude(substitution => substitution.SubstituteTrainer)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);
    }

    private static async Task<HashSet<Guid>> LoadAccessibleSubstituteOccurrenceIdsAsync(
        GymCrmDbContext dbContext,
        User currentUser,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        if (currentUser.Role != UserRole.Coach)
        {
            return [];
        }

        return (await dbContext.LessonOccurrenceTrainerSubstitutions
                .AsNoTracking()
                .Where(substitution =>
                    substitution.SubstituteTrainerId == currentUser.Id &&
                    substitution.CancelledAt == null &&
                    substitution.LessonOccurrence.LessonDate >= from &&
                    substitution.LessonOccurrence.LessonDate <= to)
                .Select(substitution => substitution.LessonOccurrenceId)
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private static ScheduleFilterOptions BuildFilterOptions(
        IReadOnlyCollection<LessonSeries> series)
    {
        return new ScheduleFilterOptions(
            series
                .GroupBy(item => new { item.Group.BranchId, item.Group.Branch.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOption(group.Key.BranchId, group.Key.Name))
                .ToArray(),
            series
                .SelectMany(item => item.RuleVersions.SelectMany(version => version.Slots))
                .GroupBy(slot => new { slot.HallId, slot.Hall.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOption(group.Key.HallId, group.Key.Name))
                .ToArray(),
            series
                .SelectMany(item => item.Group.TrainerAssignments)
                .GroupBy(assignment => new { Id = assignment.TrainerId, Name = assignment.Trainer.FullName })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOption(group.Key.Id, group.Key.Name))
                .ToArray(),
            series
                .OrderBy(item => item.Group.Name)
                .ThenBy(item => item.GroupId)
                .Select(item => new ScheduleFilterOption(item.GroupId, item.Group.Name))
                .ToArray(),
            series
                .GroupBy(item => new { item.Group.GroupTypeId, item.Group.GroupType.Name })
                .OrderBy(group => group.Key.Name)
                .Select(group => new ScheduleFilterOption(group.Key.GroupTypeId, group.Key.Name))
                .ToArray());
    }

}
