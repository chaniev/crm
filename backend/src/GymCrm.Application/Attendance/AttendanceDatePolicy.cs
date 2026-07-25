using GymCrm.Domain.Users;

namespace GymCrm.Application.Attendance;

public interface IAttendanceDatePolicy
{
    AttendanceDateWindow GetWindow(UserRole role);

    bool IsAllowed(UserRole role, DateOnly trainingDate);
}

public sealed record AttendanceDateWindow(
    DateOnly? MinTrainingDate,
    DateOnly MaxTrainingDate,
    DateOnly Today);

public sealed class AttendanceDatePolicy(IBusinessDateProvider businessDateProvider) : IAttendanceDatePolicy
{
    public AttendanceDateWindow GetWindow(UserRole role)
    {
        var today = businessDateProvider.Today;
        var minTrainingDate = role == UserRole.Coach
            ? today.AddDays(-2)
            : (DateOnly?)null;

        return new AttendanceDateWindow(minTrainingDate, today, today);
    }

    public bool IsAllowed(UserRole role, DateOnly trainingDate)
    {
        var window = GetWindow(role);
        return trainingDate <= window.MaxTrainingDate &&
            (!window.MinTrainingDate.HasValue || trainingDate >= window.MinTrainingDate.Value);
    }
}
