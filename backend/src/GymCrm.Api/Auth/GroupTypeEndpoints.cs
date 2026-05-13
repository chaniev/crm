using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Domain.Groups;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class GroupTypeEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGroupTypeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/group-types")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageSettings);

        group.MapGet("/", ListGroupTypesAsync);
        group.MapGet("/{id:guid}", GetGroupTypeAsync);
        group.MapPost("/", CreateGroupTypeAsync);
        group.MapPut("/{id:guid}", UpdateGroupTypeAsync);
        group.MapDelete("/{id:guid}", DeleteGroupTypeAsync);

        return endpoints;
    }

    private static async Task<Ok<IReadOnlyList<GroupTypeResponse>>> ListGroupTypesAsync(
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var groupTypes = await dbContext.GroupTypes
            .AsNoTracking()
            .Include(groupType => groupType.Groups)
            .OrderBy(groupType => groupType.Name)
            .ThenBy(groupType => groupType.SystemIdentifier)
            .ToListAsync(cancellationToken);

        return TypedResults.Ok<IReadOnlyList<GroupTypeResponse>>(
            groupTypes.Select(MapGroupType).ToArray());
    }

    private static async Task<Results<Ok<GroupTypeResponse>, NotFound>> GetGroupTypeAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var groupType = await LoadGroupTypeSnapshotAsync(id, dbContext, cancellationToken);

        return groupType is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapGroupType(groupType));
    }

    private static async Task<Results<Created<GroupTypeResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateGroupTypeAsync(
        UpsertGroupTypeRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var now = DateTimeOffset.UtcNow;
        var groupType = new GroupType
        {
            Id = Guid.NewGuid(),
            Name = normalizedRequest.Name,
            Description = normalizedRequest.Description,
            SystemIdentifier = normalizedRequest.SystemIdentifier,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.GroupTypes.Add(groupType);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupTypeAuditConstants.GroupTypeCreatedAction,
                GroupTypeAuditConstants.GroupTypeEntityType,
                groupType.Id.ToString(),
                GroupTypeResources.GroupTypeCreatedDescription(currentUser.Login, groupType.Name),
                NewValueJson: SerializeAuditState(groupType)),
            cancellationToken);

        var createdGroupType = await LoadGroupTypeSnapshotAsync(groupType.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created group type '{groupType.Id}' was not found.");

        return TypedResults.Created($"/group-types/{groupType.Id}", MapGroupType(createdGroupType));
    }

    private static async Task<Results<Ok<GroupTypeResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateGroupTypeAsync(
        Guid id,
        UpsertGroupTypeRequest request,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var groupType = await dbContext.GroupTypes
            .Include(candidate => candidate.Groups)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (groupType is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeRequest(request);
        var validationErrors = await ValidateRequestAsync(
            normalizedRequest,
            dbContext,
            cancellationToken,
            id);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeAuditState(groupType);

        groupType.Name = normalizedRequest.Name;
        groupType.Description = normalizedRequest.Description;
        groupType.SystemIdentifier = normalizedRequest.SystemIdentifier;
        groupType.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupTypeAuditConstants.GroupTypeUpdatedAction,
                GroupTypeAuditConstants.GroupTypeEntityType,
                groupType.Id.ToString(),
                GroupTypeResources.GroupTypeUpdatedDescription(currentUser.Login, groupType.Name),
                oldState,
                SerializeAuditState(groupType)),
            cancellationToken);

        var updatedGroupType = await LoadGroupTypeSnapshotAsync(groupType.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated group type '{groupType.Id}' was not found.");

        return TypedResults.Ok(MapGroupType(updatedGroupType));
    }

    private static async Task<Results<NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> DeleteGroupTypeAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrfValidationResult = await AuthCsrfValidation.ValidateRequestAsync(httpContext, antiforgery);
        if (csrfValidationResult is not null)
        {
            return csrfValidationResult;
        }

        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return TypedResults.Unauthorized();
        }

        var groupType = await dbContext.GroupTypes
            .Include(candidate => candidate.Groups)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (groupType is null)
        {
            return TypedResults.NotFound();
        }

        if (groupType.Groups.Count > 0)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["groupType"] = [GroupTypeResources.GroupTypeCannotBeDeletedWithGroups]
            });
        }

        var oldState = SerializeAuditState(groupType);
        dbContext.GroupTypes.Remove(groupType);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                GroupTypeAuditConstants.GroupTypeDeletedAction,
                GroupTypeAuditConstants.GroupTypeEntityType,
                groupType.Id.ToString(),
                GroupTypeResources.GroupTypeDeletedDescription(currentUser.Login, groupType.Name),
                OldValueJson: oldState),
            cancellationToken);

        return TypedResults.NoContent();
    }

    private static async Task<GroupType?> LoadGroupTypeSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.GroupTypes
            .AsNoTracking()
            .Include(groupType => groupType.Groups)
            .SingleOrDefaultAsync(groupType => groupType.Id == id, cancellationToken);
    }

    private static GroupTypeResponse MapGroupType(GroupType groupType)
    {
        return new GroupTypeResponse(
            groupType.Id,
            groupType.Name,
            groupType.Description,
            groupType.SystemIdentifier,
            groupType.Groups.Count,
            groupType.CreatedAt,
            groupType.UpdatedAt);
    }

    private static NormalizedGroupTypeRequest NormalizeRequest(UpsertGroupTypeRequest request)
    {
        var description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();

        return new NormalizedGroupTypeRequest(
            request.Name?.Trim() ?? string.Empty,
            description,
            request.SystemIdentifier?.Trim() ?? string.Empty);
    }

    private static async Task<Dictionary<string, string[]>> ValidateRequestAsync(
        NormalizedGroupTypeRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken,
        Guid? existingGroupTypeId = null)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = [GroupTypeResources.NameRequired];
        }
        else if (request.Name.Length > GroupType.NameMaxLength)
        {
            errors["name"] = [GroupTypeResources.NameTooLong(GroupType.NameMaxLength)];
        }

        if (request.Description is { Length: > GroupType.DescriptionMaxLength })
        {
            errors["description"] = [GroupTypeResources.DescriptionTooLong];
        }

        if (string.IsNullOrWhiteSpace(request.SystemIdentifier))
        {
            errors["systemIdentifier"] = [GroupTypeResources.SystemIdentifierRequired];
        }
        else if (request.SystemIdentifier.Length > GroupType.SystemIdentifierMaxLength)
        {
            errors["systemIdentifier"] = [GroupTypeResources.SystemIdentifierTooLong(GroupType.SystemIdentifierMaxLength)];
        }

        if (errors.ContainsKey("name") && errors.ContainsKey("systemIdentifier"))
        {
            return errors;
        }

        if (!errors.ContainsKey("name"))
        {
            var duplicateNameExists = await dbContext.GroupTypes
                .AsNoTracking()
                .AnyAsync(
                    candidate =>
                        candidate.Name == request.Name &&
                        (!existingGroupTypeId.HasValue || candidate.Id != existingGroupTypeId.Value),
                    cancellationToken);
            if (duplicateNameExists)
            {
                errors["name"] = [GroupTypeResources.NameAlreadyExists];
            }
        }

        if (!errors.ContainsKey("systemIdentifier"))
        {
            var duplicateIdentifierExists = await dbContext.GroupTypes
                .AsNoTracking()
                .AnyAsync(
                    candidate =>
                        candidate.SystemIdentifier == request.SystemIdentifier &&
                        (!existingGroupTypeId.HasValue || candidate.Id != existingGroupTypeId.Value),
                    cancellationToken);
            if (duplicateIdentifierExists)
            {
                errors["systemIdentifier"] = [GroupTypeResources.SystemIdentifierAlreadyExists];
            }
        }

        return errors;
    }

    private static string SerializeAuditState(GroupType groupType)
    {
        return JsonSerializer.Serialize(
            new GroupTypeAuditState(
                groupType.Id,
                groupType.Name,
                groupType.Description,
                groupType.SystemIdentifier,
                groupType.Groups.Count,
                groupType.CreatedAt,
                groupType.UpdatedAt),
            AuditSerializerOptions);
    }

    private sealed record NormalizedGroupTypeRequest(
        string Name,
        string? Description,
        string SystemIdentifier);
}
