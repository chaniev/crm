namespace GymCrm.Application.Scheduling;

public sealed record ScheduleFilterOptions(
    IReadOnlyList<ScheduleFilterOption> Branches,
    IReadOnlyList<ScheduleFilterOption> Halls,
    IReadOnlyList<ScheduleFilterOption> Trainers,
    IReadOnlyList<ScheduleFilterOption> Groups,
    IReadOnlyList<ScheduleFilterOption> GroupTypes);
