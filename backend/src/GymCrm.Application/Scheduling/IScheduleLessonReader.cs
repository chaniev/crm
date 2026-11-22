using GymCrm.Domain.Users;

namespace GymCrm.Application.Scheduling;

public interface IScheduleLessonReader
{
    Task<ScheduleReadResult> ReadAsync(User actor, ScheduleReadQuery query, CancellationToken cancellationToken);
}
