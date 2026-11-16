namespace GymCrm.Application.Scheduling;

public sealed record ScheduleReadQuery(
    DateOnly From,
    DateOnly To,
    Guid? BranchId = null,
    Guid? HallId = null,
    Guid? GroupId = null,
    Guid? GroupTypeId = null);
