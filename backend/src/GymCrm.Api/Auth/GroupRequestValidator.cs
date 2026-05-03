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
        CancellationToken cancellationToken)
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

        if (string.IsNullOrWhiteSpace(request.ScheduleText))
        {
            errors["scheduleText"] = [GroupResources.ScheduleTextRequired];
        }
        else if (request.ScheduleText.Length > GroupApiConstants.ScheduleTextMaxLength)
        {
            errors["scheduleText"] = [GroupResources.ScheduleTextTooLong(GroupApiConstants.ScheduleTextMaxLength)];
        }

        if (ParseTrainingStartTime(request.TrainingStartTime) is null)
        {
            errors["trainingStartTime"] = [GroupResources.TrainingStartTimeInvalid(GroupApiConstants.TrainingStartTimeDisplayFormat)];
        }

        var trainerErrors = await ValidateTrainerIdsAsync(request.RawTrainerIds, request.TrainerIds, dbContext, cancellationToken);
        foreach (var error in trainerErrors)
        {
            errors[error.Key] = error.Value;
        }

        return errors;
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
            .Where(user => normalizedTrainerIds.Contains(user.Id) && user.IsActive && user.Role == UserRole.Coach)
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
            request.TrainingStartTime?.Trim() ?? string.Empty,
            request.ScheduleText?.Trim() ?? string.Empty,
            request.IsActive,
            request.TrainerIds,
            NormalizeTrainerIds(request.TrainerIds));
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
