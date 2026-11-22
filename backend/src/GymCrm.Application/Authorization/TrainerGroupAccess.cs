namespace GymCrm.Application.Authorization;

/// <summary>A current assignment. Permanent assignments cover any lesson date.</summary>
public sealed record TrainerGroupAccess(Guid GroupId, DateOnly? StartsOn, DateOnly? EndsOn)
{
    public bool Covers(DateOnly lessonDate) =>
        (!StartsOn.HasValue || StartsOn <= lessonDate) && (!EndsOn.HasValue || EndsOn >= lessonDate);
}
