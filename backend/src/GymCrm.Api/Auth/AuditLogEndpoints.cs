using System.Globalization;
using System.Text.Json;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class AuditLogEndpoints
{
    public static IEndpointRouteBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(AuditLogApiConstants.RoutePrefix)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewAuditLog);

        group.MapGet(AuditLogApiConstants.ListRoute, ListAuditLogsAsync);
        group.MapGet(AuditLogApiConstants.OptionsRoute, GetAuditLogOptionsAsync);

        return endpoints;
    }

    private static async Task<Results<Ok<AuditLogListResponse>, ValidationProblem>> ListAuditLogsAsync(
        int? page,
        int? pageSize,
        int? skip,
        int? take,
        string? dateFrom,
        string? dateTo,
        string? userId,
        string? actionType,
        string? entityType,
        string? source,
        string? messengerPlatform,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidatePaging(page, pageSize, skip, take);

        var parsedDateFrom = ParseDate(dateFrom);
        var parsedDateTo = ParseDate(dateTo);
        var normalizedUserId = userId?.Trim();
        var normalizedActionType = actionType?.Trim();
        var normalizedEntityType = entityType?.Trim();
        var normalizedSource = source?.Trim();
        var normalizedMessengerPlatform = messengerPlatform?.Trim();

        if (!string.IsNullOrWhiteSpace(dateFrom) && !parsedDateFrom.HasValue)
        {
            errors["dateFrom"] = [AuditLogResources.DateMustUseFormat(AuditLogApiConstants.DateFormat)];
        }

        if (!string.IsNullOrWhiteSpace(dateTo) && !parsedDateTo.HasValue)
        {
            errors["dateTo"] = [AuditLogResources.DateMustUseFormat(AuditLogApiConstants.DateFormat)];
        }

        if (parsedDateFrom.HasValue && parsedDateTo.HasValue && parsedDateTo.Value < parsedDateFrom.Value)
        {
            errors["dateTo"] = [AuditLogResources.DateToCannotBeBeforeDateFrom];
        }

        Guid? parsedUserId = null;
        if (!string.IsNullOrWhiteSpace(normalizedUserId))
        {
            if (!Guid.TryParse(normalizedUserId, out var value))
            {
                errors["userId"] = [AuditLogResources.UserIdInvalid];
            }
            else
            {
                parsedUserId = value;
            }
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var paging = ResolvePaging(page, pageSize, skip, take);
        var rangeStart = parsedDateFrom.HasValue
            ? new DateTimeOffset(parsedDateFrom.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero)
            : (DateTimeOffset?)null;
        var rangeEndExclusive = parsedDateTo.HasValue
            ? new DateTimeOffset(parsedDateTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero)
            : (DateTimeOffset?)null;

        var query = dbContext.AuditLogs
            .AsNoTracking()
            .Include(auditLog => auditLog.User)
            .AsQueryable();

        if (rangeStart.HasValue)
        {
            query = query.Where(auditLog => auditLog.CreatedAt >= rangeStart.Value);
        }

        if (rangeEndExclusive.HasValue)
        {
            query = query.Where(auditLog => auditLog.CreatedAt < rangeEndExclusive.Value);
        }

        if (parsedUserId.HasValue)
        {
            query = query.Where(auditLog => auditLog.UserId == parsedUserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(normalizedActionType))
        {
            query = query.Where(auditLog => auditLog.ActionType == normalizedActionType);
        }

        if (!string.IsNullOrWhiteSpace(normalizedEntityType))
        {
            query = query.Where(auditLog => auditLog.EntityType == normalizedEntityType);
        }

        if (!string.IsNullOrWhiteSpace(normalizedSource))
        {
            query = query.Where(auditLog => auditLog.Source == normalizedSource);
        }

        if (!string.IsNullOrWhiteSpace(normalizedMessengerPlatform))
        {
            query = query.Where(auditLog => auditLog.MessengerPlatform == normalizedMessengerPlatform);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(auditLog => auditLog.CreatedAt)
            .ThenByDescending(auditLog => auditLog.Id)
            .Skip(paging.Skip)
            .Take(paging.Take)
            .Select(auditLog => new AuditLogListItemProjection(
                auditLog.Id,
                new AuditLogUserProjection(
                    auditLog.User.Id,
                    auditLog.User.FullName,
                    auditLog.User.Login,
                    auditLog.User.Role),
                auditLog.ActionType,
                auditLog.EntityType,
                auditLog.EntityId,
                auditLog.Description,
                auditLog.Source,
                auditLog.MessengerPlatform,
                auditLog.OldValueJson,
                auditLog.NewValueJson,
                auditLog.CreatedAt))
            .ToArrayAsync(cancellationToken);

        return TypedResults.Ok(new AuditLogListResponse(
            items
                .Select(item => new AuditLogListItemResponse(
                    item.Id,
                    new AuditLogUserResponse(
                        item.User.Id,
                        item.User.FullName,
                        item.User.Login,
                        item.User.Role.ToString()),
                    item.ActionType,
                    item.EntityType,
                    item.EntityId,
                    item.Description,
                    item.Source,
                    item.MessengerPlatform,
                    SanitizeAuditJson(item.OldValueJson),
                    SanitizeAuditJson(item.NewValueJson),
                    item.CreatedAt))
                .ToArray(),
            totalCount,
            paging.Skip,
            paging.Take,
            paging.Page,
            paging.PageSize,
            paging.Skip + items.Length < totalCount));
    }

    private static async Task<Ok<AuditLogFilterOptionsResponse>> GetAuditLogOptionsAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var users = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.AuditLogs.Any())
            .OrderBy(user => user.FullName)
            .ThenBy(user => user.Login)
            .Select(user => new AuditLogUserOptionProjection(
                user.Id,
                user.FullName,
                user.Login,
                user.Role))
            .ToArrayAsync(cancellationToken);

        var actionTypes = await dbContext.AuditLogs
            .AsNoTracking()
            .Select(auditLog => auditLog.ActionType)
            .Distinct()
            .OrderBy(actionType => actionType)
            .ToArrayAsync(cancellationToken);

        var entityTypes = await dbContext.AuditLogs
            .AsNoTracking()
            .Select(auditLog => auditLog.EntityType)
            .Distinct()
            .OrderBy(entityType => entityType)
            .ToArrayAsync(cancellationToken);

        var sources = await dbContext.AuditLogs
            .AsNoTracking()
            .Select(auditLog => auditLog.Source)
            .Distinct()
            .OrderBy(value => value)
            .ToArrayAsync(cancellationToken);

        var messengerPlatforms = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(auditLog => auditLog.MessengerPlatform != null)
            .Select(auditLog => auditLog.MessengerPlatform!)
            .Distinct()
            .OrderBy(value => value)
            .ToArrayAsync(cancellationToken);

        return TypedResults.Ok(new AuditLogFilterOptionsResponse(
            users
                .Select(user => new AuditLogUserResponse(
                    user.Id,
                    user.FullName,
                    user.Login,
                    user.Role.ToString()))
                .ToArray(),
            actionTypes,
            entityTypes,
            sources,
            messengerPlatforms));
    }

    private static DateOnly? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParseExact(
            value.Trim(),
            AuditLogApiConstants.DateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsed)
            ? parsed
            : null;
    }

    private static Dictionary<string, string[]> ValidatePaging(int? page, int? pageSize, int? skip, int? take)
    {
        var errors = new Dictionary<string, string[]>();

        if (page.HasValue || pageSize.HasValue)
        {
            if (page is <= 0)
            {
                errors["page"] = [AuditLogResources.PageMustBeGreaterThanZero];
            }

            if (pageSize is <= 0 or > AuditLogApiConstants.MaxTake)
            {
                errors["pageSize"] = [AuditLogResources.PageSizeMustBeInRange(AuditLogApiConstants.MaxTake)];
            }

            return errors;
        }

        if (skip is < 0)
        {
            errors["skip"] = [AuditLogResources.SkipCannotBeNegative];
        }

        if (take is <= 0 or > AuditLogApiConstants.MaxTake)
        {
            errors["take"] = [AuditLogResources.TakeMustBeInRange(AuditLogApiConstants.MaxTake)];
        }

        return errors;
    }

    private static AuditLogPaging ResolvePaging(int? page, int? pageSize, int? skip, int? take)
    {
        if (page.HasValue || pageSize.HasValue)
        {
            var resolvedPage = page.GetValueOrDefault(AuditLogApiConstants.DefaultPage);
            var resolvedPageSize = pageSize.GetValueOrDefault(AuditLogApiConstants.DefaultTake);

            return new AuditLogPaging(
                (resolvedPage - 1) * resolvedPageSize,
                resolvedPageSize,
                resolvedPage,
                resolvedPageSize);
        }

        var resolvedTake = take.GetValueOrDefault(AuditLogApiConstants.DefaultTake);
        var resolvedSkip = skip.GetValueOrDefault(0);

        return new AuditLogPaging(
            resolvedSkip,
            resolvedTake,
            Math.Max((resolvedSkip / Math.Max(resolvedTake, 1)) + 1, 1),
            resolvedTake);
    }

    private static string? SanitizeAuditJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return json;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            using var buffer = new MemoryStream();
            using (var writer = new Utf8JsonWriter(buffer))
            {
                WriteSanitizedElement(document.RootElement, writer);
            }

            return System.Text.Encoding.UTF8.GetString(buffer.ToArray());
        }
        catch (JsonException)
        {
            return ContainsSensitiveToken(json)
                ? "{\"redacted\":true,\"reason\":\"sensitive-data-removed\"}"
                : json;
        }
    }

    private static void WriteSanitizedElement(JsonElement element, Utf8JsonWriter writer)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in element.EnumerateObject())
                {
                    writer.WritePropertyName(property.Name);

                    if (IsSensitiveProperty(property.Name))
                    {
                        writer.WriteStringValue("[REDACTED]");
                        continue;
                    }

                    WriteSanitizedElement(property.Value, writer);
                }

                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray())
                {
                    WriteSanitizedElement(item, writer);
                }

                writer.WriteEndArray();
                break;
            default:
                element.WriteTo(writer);
                break;
        }
    }

    private static bool ContainsSensitiveToken(string value)
    {
        return value.Contains("password", StringComparison.OrdinalIgnoreCase)
            || value.Contains("hash", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsSensitiveProperty(string propertyName)
    {
        return propertyName.Contains("password", StringComparison.OrdinalIgnoreCase)
            || propertyName.EndsWith("hash", StringComparison.OrdinalIgnoreCase);
    }

}
