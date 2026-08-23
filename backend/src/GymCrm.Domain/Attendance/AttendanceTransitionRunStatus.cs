namespace GymCrm.Domain.Attendance;

public enum AttendanceTransitionRunStatus
{
    DryRun = 0,
    Blocked = 1,
    ReadyForActivation = 2,
    Activated = 3
}
