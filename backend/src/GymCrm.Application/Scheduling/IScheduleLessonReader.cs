using GymCrm.Domain.Users;

namespace GymCrm.Application.Scheduling;

public interface IScheduleLessonReader
{
    Task<ScheduleReadResult> ReadAsync(User actor, ScheduleReadQuery query, CancellationToken cancellationToken);

    // Retains the existing attendance fallback, whose caller resolves persisted occurrences first.
    Task<ScheduleLessonFacts?> FindRecurringAsync(User actor, Guid occurrenceId, DateOnly date, CancellationToken cancellationToken);
}
