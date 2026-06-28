using System.Globalization;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class GroupRequestValidator
{
    public static Dictionary<string, string[]> ValidatePaging(int? page, int? pageSize, int? skip, int? take)
    {
        var errors = new Dictionary<string, string[]>();

        if (page.HasValue || pageSize.HasValue)
        {
            if (page is <= 0)
            {
                errors["page"] = [GroupResources.PageMustBeGreaterThanZero];
            }

            if (pageSize is <= 0 or > GroupApiConstants.MaxTake)
            {
                errors["pageSize"] = [GroupResources.PageSizeMustBeInRange(GroupApiConstants.MaxTake)];
            }

            return errors;
        }

        if (skip is < 0)
        {
            errors["skip"] = [GroupResources.SkipCannotBeNegative];
        }

        if (take is <= 0 or > GroupApiConstants.MaxTake)
        {
            errors["take"] = [GroupResources.TakeMustBeInRange(GroupApiConstants.MaxTake)];
        }

        return errors;
    }

    public static GroupPaging ResolvePaging(int? page, int? pageSize, int? skip, int? take)
    {
        if (page.HasValue || pageSize.HasValue)
        {
            var resolvedPage = page ?? GroupApiConstants.DefaultPage;
            var resolvedPageSize = pageSize ?? GroupApiConstants.DefaultTake;
            return new GroupPaging((resolvedPage - 1) * resolvedPageSize, resolvedPageSize);
        }

        return new GroupPaging(skip ?? 0, take ?? GroupApiConstants.DefaultTake);
    }

    public static async Task<Dictionary<string, string[]>> ValidateUpsertRequestAsync(
        NormalizedGroupRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken,
        Guid? existingGroupId = null)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = [GroupResources.NameRequired];
        }
        else if (request.Name.Length > GroupApiConstants.NameMaxLength)
        {
            errors["name"] = [GroupResources.NameTooLong(GroupApiConstants.NameMaxLength)];
        }

        ValidateSchedule(request, errors);

        if (ParseTrainingStartTime(request.TrainingStartTime) is null)
        {
            errors["trainingStartTime"] = [GroupResources.TrainingStartTimeInvalid(GroupApiConstants.TrainingStartTimeDisplayFormat)];
        }

        await ValidateBranchAndHallAsync(request, existingGroupId, errors, dbContext, cancellationToken);
        await ValidateGroupTypeAsync(request, errors, dbContext, cancellationToken);

        var trainerErrors = await ValidateTrainerIdsAsync(request.RawTrainerIds, request.TrainerIds, dbContext, cancellationToken);
        foreach (var error in trainerErrors)
        {
            errors[error.Key] = error.Value;
        }

        return errors;
    }

    private static async Task ValidateBranchAndHallAsync(
        NormalizedGroupRequest request,
        Guid? existingGroupId,
        Dictionary<string, string[]> errors,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.BranchId.HasValue)
        {
            errors["branchId"] = [GroupResources.BranchRequired];
        }
        else if (request.BranchId.Value == Guid.Empty)
        {
            errors["branchId"] = [GroupResources.InvalidBranchId];
        }

        if (!request.HallId.HasValue)
        {
            errors["hallId"] = [GroupResources.HallRequired];
        }
        else if (request.HallId.Value == Guid.Empty)
        {
            errors["hallId"] = [GroupResources.InvalidHallId];
        }

        if (errors.ContainsKey("branchId") || errors.ContainsKey("hallId"))
        {
            return;
        }

        var branchId = request.BranchId!.Value;
        var branch = await dbContext.Branches
            .AsNoTracking()
            .Where(candidate => candidate.Id == branchId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IsArchived
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (branch is null)
        {
            errors["branchId"] = [GroupResources.BranchMustExist];
            return;
        }

        if (branch.IsArchived)
        {
            errors["branchId"] = [GroupResources.BranchMustBeActive];
            return;
        }

        if (existingGroupId.HasValue)
        {
            var existingGroupBranchId = await dbContext.TrainingGroups
                .AsNoTracking()
                .Where(group => group.Id == existingGroupId.Value)
                .Select(group => (Guid?)group.BranchId)
                .SingleOrDefaultAsync(cancellationToken);

            if (existingGroupBranchId.HasValue && existingGroupBranchId.Value != branchId)
            {
                errors["branchId"] = [GroupResources.GroupBranchImmutable];
                return;
            }
        }

        var hallId = request.HallId!.Value;
        var hall = await dbContext.Halls
            .AsNoTracking()
            .Where(candidate => candidate.Id == hallId)
            .Select(candidate => new
            {
                candidate.BranchId,
                candidate.IsArchived
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (hall is null)
        {
            errors["hallId"] = [GroupResources.HallMustExist];
            return;
        }

        if (hall.IsArchived)
        {
            errors["hallId"] = [GroupResources.HallMustBeActive];
            return;
        }

        if (hall.BranchId != branchId)
        {
            errors["hallId"] = [GroupResources.HallMustBelongToBranch];
            return;
        }

        if (!existingGroupId.HasValue)
        {
            return;
        }

        var hasClientsFromAnotherBranch = await dbContext.ClientGroups
            .AsNoTracking()
            .AnyAsync(
                clientGroup =>
                    clientGroup.GroupId == existingGroupId.Value &&
                    clientGroup.Client.BranchId != branchId,
                cancellationToken);

        if (hasClientsFromAnotherBranch)
        {
            errors["branchId"] = [GroupResources.AssignedClientsMustBelongToBranch];
        }
    }

    private static async Task ValidateGroupTypeAsync(
        NormalizedGroupRequest request,
        Dictionary<string, string[]> errors,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.GroupTypeId.HasValue)
        {
            errors["groupTypeId"] = [GroupResources.GroupTypeRequired];
            return;
        }

        if (request.GroupTypeId.Value == Guid.Empty)
        {
            errors["groupTypeId"] = [GroupResources.InvalidGroupTypeId];
            return;
        }

        var groupTypeExists = await dbContext.GroupTypes
            .AsNoTracking()
            .AnyAsync(groupType => groupType.Id == request.GroupTypeId.Value, cancellationToken);

        if (!groupTypeExists)
        {
            errors["groupTypeId"] = [GroupResources.GroupTypeMustExist];
        }
    }

    public static async Task<Dictionary<string, string[]>> ValidateTrainerIdsAsync(
        IReadOnlyList<Guid>? rawTrainerIds,
        IReadOnlyList<Guid> normalizedTrainerIds,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (rawTrainerIds?.Any(trainerId => trainerId == Guid.Empty) == true)
        {
            errors["trainerIds"] = [GroupResources.InvalidTrainerId];
            return errors;
        }

        if (normalizedTrainerIds.Count == 0)
        {
            return errors;
        }

        var validTrainerCount = await dbContext.Users
            .AsNoTracking()
            .Where(user =>
                normalizedTrainerIds.Contains(user.Id) &&
                user.IsActive &&
                GroupTrainerEligibility.AssignableRoles.Contains(user.Role))
            .CountAsync(cancellationToken);

        if (validTrainerCount != normalizedTrainerIds.Count)
        {
            errors["trainerIds"] = [GroupResources.OnlyActiveCoachesCanBeAssigned];
        }

        return errors;
    }

    public static NormalizedGroupRequest NormalizeRequest(UpsertTrainingGroupRequest request)
    {
        return new NormalizedGroupRequest(
            request.Name?.Trim() ?? string.Empty,
            request.BranchId,
            request.HallId,
            request.GroupTypeId,
            request.TrainingStartTime?.Trim() ?? string.Empty,
            request.DurationMinutes,
            request.Weekdays,
            NormalizeWeekdays(request.Weekdays),
            request.IsActive,
            request.TrainerIds,
            NormalizeTrainerIds(request.TrainerIds));
    }

    private static void ValidateSchedule(
        NormalizedGroupRequest request,
        Dictionary<string, string[]> errors)
    {
        if (!request.DurationMinutes.HasValue)
        {
            errors["durationMinutes"] = [GroupResources.DurationMinutesRequired];
        }
        else if (request.DurationMinutes.Value is < GroupApiConstants.MinDurationMinutes or > GroupApiConstants.MaxDurationMinutes)
        {
            errors["durationMinutes"] =
                [GroupResources.DurationMinutesOutOfRange(GroupApiConstants.MinDurationMinutes, GroupApiConstants.MaxDurationMinutes)];
        }

        if (request.RawWeekdays is null || request.RawWeekdays.Count == 0)
        {
            errors["weekdays"] = [GroupResources.WeekdaysRequired];
            return;
        }

        var weekdayErrors = new List<string>();
        if (request.RawWeekdays.Any(weekday => weekday is < 1 or > 7))
        {
            weekdayErrors.Add(GroupResources.WeekdaysOutOfRange);
        }

        if (request.RawWeekdays.Distinct().Count() != request.RawWeekdays.Count)
        {
            weekdayErrors.Add(GroupResources.WeekdaysDuplicates);
        }

        if (weekdayErrors.Count > 0)
        {
            errors["weekdays"] = weekdayErrors.ToArray();
        }
    }

    private static int[] NormalizeWeekdays(IReadOnlyList<int>? weekdays)
    {
        return weekdays?
            .Distinct()
            .OrderBy(weekday => weekday)
            .ToArray() ?? [];
    }

    public static IReadOnlyList<Guid> NormalizeTrainerIds(IReadOnlyList<Guid>? trainerIds)
    {
        return trainerIds?
            .Where(trainerId => trainerId != Guid.Empty)
            .Distinct()
            .OrderBy(trainerId => trainerId)
            .ToArray() ?? [];
    }

    public static TimeOnly? ParseTrainingStartTime(string? trainingStartTime)
    {
        return TimeOnly.TryParseExact(
            trainingStartTime?.Trim(),
            GroupApiConstants.SupportedTimeFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedTime)
            ? parsedTime
            : null;
    }
}
