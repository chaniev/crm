using GymCrm.Domain.Schedule;

namespace GymCrm.Application.Scheduling;

public sealed record ScheduleLessonFacts(
    Guid LessonOccurrenceId,
    LessonOccurrenceSourceKind SourceKind,
    bool IsMaterialized,
    Guid? LessonSeriesId,
    DateOnly LessonDate,
    TimeOnly StartTime,
    int DurationMinutes,
    Guid GroupId,
    string GroupName,
    Guid GroupTypeId,
    string GroupTypeName,
    Guid BranchId,
    string BranchName,
    Guid HallId,
    string HallName,
    IReadOnlyList<ScheduleEffectiveTrainer> EffectiveTrainers,
    LessonOccurrenceStatus Status,
    bool HasAttendanceMarks,
    string SourceRevision,
    bool CanViewAttendance,
    bool CanEditAttendance,
    bool IsAccessibleThroughSubstitution = false);
