using System.Globalization;
using GymCrm.Application.Scheduling;
using GymCrm.Domain.Groups;

namespace GymCrm.Api.Auth;

internal static class GroupTrainerAssignmentRevision
{
    public static string Create(Guid groupId, IEnumerable<GroupTrainerAssignment> assignments)
    {
        var canonical = string.Join(
            "|",
            groupId.ToString("D"),
            string.Join(
                ";",
                assignments
                    .OrderBy(assignment => assignment.ValidFrom)
                    .ThenBy(assignment => assignment.ValidTo)
                    .ThenBy(assignment => assignment.TrainerId)
                    .Select(assignment => string.Join(
                        ",",
                        assignment.TrainerId.ToString("D"),
                        assignment.ValidFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        assignment.ValidTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty))));

        return ScheduleMutationTokenPolicy.ComputeSha256Base64Url(canonical);
    }
}
