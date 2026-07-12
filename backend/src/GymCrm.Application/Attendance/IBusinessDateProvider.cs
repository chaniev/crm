namespace GymCrm.Application.Attendance;

public interface IBusinessDateProvider
{
    DateOnly Today { get; }
}
