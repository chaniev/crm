namespace GymCrm.Application.Scheduling;

public sealed record ScheduleEffectiveTrainer(
    Guid TrainerId,
    string FullName,
    ScheduleTrainerKind Kind,
    Guid? ReplacedTrainerId,
    Guid? SubstitutionId);
