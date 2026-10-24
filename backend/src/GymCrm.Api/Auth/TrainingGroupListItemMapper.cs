using System.Globalization;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;

namespace GymCrm.Api.Auth;

internal static class TrainingGroupListItemMapper
{
    public static GroupListItemResponse Map(TrainingGroup group, User actor)
    {
        var trainers = group.Trainers
            .Select(groupTrainer => groupTrainer.Trainer)
            .OrderBy(trainer => trainer.FullName, StringComparer.CurrentCulture)
            .ThenBy(trainer => trainer.Login, StringComparer.CurrentCulture)
            .Select(trainer => new TrainerSummaryResponse(
                trainer.Id,
                trainer.FullName,
                trainer.Login))
            .ToArray();

        return new GroupListItemResponse(
            group.Id,
            group.Name,
            group.BranchId,
            group.Branch.Name,
            group.HallId,
            group.Hall.Name,
            group.GroupTypeId,
            group.GroupType.Name,
            group.TrainingStartTime.ToString("HH':'mm", CultureInfo.InvariantCulture),
            group.DurationMinutes,
            group.Weekdays.OrderBy(weekday => weekday).ToArray(),
            group.IsActive,
            trainers,
            trainers.Select(trainer => trainer.Id).ToArray(),
            trainers.Length,
            trainers.Select(trainer => trainer.FullName).ToArray(),
            actor.Role != UserRole.Administrator || ClientAccessPolicy.CanAccessBranch(actor, group.BranchId)
                ? group.Clients.Count : null,
            group.UpdatedAt);
    }
}
