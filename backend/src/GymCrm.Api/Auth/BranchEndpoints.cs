using System.Text.Json;
using GymCrm.Application.Audit;
using GymCrm.Domain.Branches;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class BranchEndpoints
{
    private static readonly JsonSerializerOptions AuditSerializerOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapBranchEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var branches = endpoints.MapGroup("/branches")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageSettings);

        branches.MapGet("/", ListBranchesAsync);
        branches.MapGet("/{id:guid}", GetBranchAsync);
        branches.MapPost("/", CreateBranchAsync);
        branches.MapPut("/{id:guid}", UpdateBranchAsync);
        branches.MapPut("/{id:guid}/archive", ArchiveBranchAsync);
        branches.MapPut("/{id:guid}/restore", RestoreBranchAsync);

        var halls = endpoints.MapGroup("/halls")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageSettings);

        halls.MapGet("/", ListHallsAsync);
        halls.MapGet("/{id:guid}", GetHallAsync);
        halls.MapPost("/", CreateHallAsync);
        halls.MapPut("/{id:guid}", UpdateHallAsync);
        halls.MapPut("/{id:guid}/archive", ArchiveHallAsync);
        halls.MapPut("/{id:guid}/restore", RestoreHallAsync);
        halls.MapDelete("/{id:guid}", DeleteHallAsync);

        return endpoints;
    }

    private static async Task<Ok<IReadOnlyList<BranchResponse>>> ListBranchesAsync(
        bool? includeArchived,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Branches.AsNoTracking();
        if (includeArchived != true)
        {
            query = query.Where(branch => !branch.IsArchived);
        }

        var branches = await query
            .OrderBy(branch => branch.IsArchived)
            .ThenBy(branch => branch.Name)
            .ThenBy(branch => branch.Id)
            .Select(branch => new BranchResponse(
                branch.Id,
                branch.Name,
                branch.Address,
                branch.Description,
                branch.IsArchived,
                branch.Halls.Count,
                branch.Groups.Count,
                branch.Clients.Count,
                branch.CreatedAt,
                branch.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        return TypedResults.Ok<IReadOnlyList<BranchResponse>>(branches);
    }

    private static async Task<Results<Ok<BranchResponse>, NotFound>> GetBranchAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var branch = await LoadBranchSnapshotAsync(id, dbContext, cancellationToken);
        return branch is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapBranch(branch));
    }

    private static async Task<Results<Created<BranchResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateBranchAsync(
        UpsertBranchRequest request,
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

        var normalizedRequest = NormalizeBranchRequest(request);
        var validationErrors = ValidateBranchRequest(normalizedRequest);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var now = DateTimeOffset.UtcNow;
        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = normalizedRequest.Name,
            Address = normalizedRequest.Address,
            Description = normalizedRequest.Description,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Branches.Add(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                BranchAuditConstants.BranchCreatedAction,
                BranchAuditConstants.BranchEntityType,
                branch.Id.ToString(),
                BranchResources.BranchCreatedDescription(currentUser.Login, branch.Name),
                NewValueJson: SerializeBranchAuditState(branch)),
            cancellationToken);

        var createdBranch = await LoadBranchSnapshotAsync(branch.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created branch '{branch.Id}' was not found.");

        return TypedResults.Created($"/branches/{branch.Id}", MapBranch(createdBranch));
    }

    private static async Task<Results<Ok<BranchResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateBranchAsync(
        Guid id,
        UpsertBranchRequest request,
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

        var branch = await dbContext.Branches.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (branch is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeBranchRequest(request);
        var validationErrors = ValidateBranchRequest(normalizedRequest);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeBranchAuditState(branch);
        branch.Name = normalizedRequest.Name;
        branch.Address = normalizedRequest.Address;
        branch.Description = normalizedRequest.Description;
        branch.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                BranchAuditConstants.BranchUpdatedAction,
                BranchAuditConstants.BranchEntityType,
                branch.Id.ToString(),
                BranchResources.BranchUpdatedDescription(currentUser.Login, branch.Name),
                oldState,
                SerializeBranchAuditState(branch)),
            cancellationToken);

        var updatedBranch = await LoadBranchSnapshotAsync(branch.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated branch '{branch.Id}' was not found.");

        return TypedResults.Ok(MapBranch(updatedBranch));
    }

    private static Task<Results<Ok<BranchResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> ArchiveBranchAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateBranchArchiveStateAsync(
            id,
            true,
            BranchAuditConstants.BranchArchivedAction,
            BranchResources.BranchArchivedDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static Task<Results<Ok<BranchResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> RestoreBranchAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return UpdateBranchArchiveStateAsync(
            id,
            false,
            BranchAuditConstants.BranchRestoredAction,
            BranchResources.BranchRestoredDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static async Task<Results<Ok<BranchResponse>, NotFound, ProblemHttpResult, UnauthorizedHttpResult>> UpdateBranchArchiveStateAsync(
        Guid id,
        bool isArchived,
        string actionType,
        Func<string, string, string> descriptionFactory,
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

        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        var supportsTransactions = !providerName.Contains("InMemory", StringComparison.OrdinalIgnoreCase);
        await using var transaction = supportsTransactions
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        await LockBranchAsync(dbContext, id, cancellationToken);

        var branch = await dbContext.Branches.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (branch is null)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            return TypedResults.NotFound();
        }

        if (branch.IsArchived == isArchived)
        {
            var currentBranch = await LoadBranchSnapshotAsync(branch.Id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Branch '{branch.Id}' was not found after archive state check.");
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return TypedResults.Ok(MapBranch(currentBranch));
        }

        var oldState = SerializeBranchAuditState(branch);
        branch.IsArchived = isArchived;
        branch.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                actionType,
                BranchAuditConstants.BranchEntityType,
                branch.Id.ToString(),
                descriptionFactory(currentUser.Login, branch.Name),
                oldState,
                SerializeBranchAuditState(branch)),
            cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var updatedBranch = await LoadBranchSnapshotAsync(branch.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated branch '{branch.Id}' was not found.");

        return TypedResults.Ok(MapBranch(updatedBranch));
    }

    private static async Task LockBranchAsync(
        GymCrmDbContext dbContext,
        Guid branchId,
        CancellationToken cancellationToken)
    {
        var providerName = dbContext.Database.ProviderName ?? string.Empty;
        if (!providerName.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""SELECT 1 FROM "Branches" WHERE "Id" = {branchId} FOR UPDATE""",
            cancellationToken);
    }

    private static async Task<Ok<IReadOnlyList<HallResponse>>> ListHallsAsync(
        Guid? branchId,
        bool? includeArchived,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Halls.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(hall => hall.BranchId == branchId.Value);
        }

        if (includeArchived != true)
        {
            query = query.Where(hall => !hall.IsArchived);
        }

        var halls = await query
            .OrderBy(hall => hall.Branch.Name)
            .ThenBy(hall => hall.IsArchived)
            .ThenBy(hall => hall.Name)
            .ThenBy(hall => hall.Id)
            .Select(hall => new HallResponse(
                hall.Id,
                hall.BranchId,
                hall.Branch.Name,
                hall.Name,
                hall.Description,
                hall.IsArchived,
                hall.Groups.Count,
                hall.CreatedAt,
                hall.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        return TypedResults.Ok<IReadOnlyList<HallResponse>>(halls);
    }

    private static async Task<Results<Ok<HallResponse>, NotFound>> GetHallAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var hall = await LoadHallSnapshotAsync(id, dbContext, cancellationToken);
        return hall is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(MapHall(hall));
    }

    private static async Task<Results<Created<HallResponse>, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> CreateHallAsync(
        UpsertHallRequest request,
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

        var normalizedRequest = NormalizeHallRequest(request);
        var validationErrors = await ValidateHallRequestAsync(normalizedRequest, dbContext, cancellationToken);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var now = DateTimeOffset.UtcNow;
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            BranchId = normalizedRequest.BranchId!.Value,
            Name = normalizedRequest.Name,
            Description = normalizedRequest.Description,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Halls.Add(hall);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                BranchAuditConstants.HallCreatedAction,
                BranchAuditConstants.HallEntityType,
                hall.Id.ToString(),
                BranchResources.HallCreatedDescription(currentUser.Login, hall.Name),
                NewValueJson: SerializeHallAuditState(hall)),
            cancellationToken);

        var createdHall = await LoadHallSnapshotAsync(hall.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Created hall '{hall.Id}' was not found.");

        return TypedResults.Created($"/halls/{hall.Id}", MapHall(createdHall));
    }

    private static async Task<Results<Ok<HallResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateHallAsync(
        Guid id,
        UpsertHallRequest request,
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

        var hall = await dbContext.Halls.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (hall is null)
        {
            return TypedResults.NotFound();
        }

        var normalizedRequest = NormalizeHallRequest(request);
        var validationErrors = await ValidateHallRequestAsync(normalizedRequest, dbContext, cancellationToken, hall.BranchId);
        if (validationErrors.Count > 0)
        {
            return TypedResults.ValidationProblem(validationErrors);
        }

        var oldState = SerializeHallAuditState(hall);
        hall.Name = normalizedRequest.Name;
        hall.Description = normalizedRequest.Description;
        hall.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                BranchAuditConstants.HallUpdatedAction,
                BranchAuditConstants.HallEntityType,
                hall.Id.ToString(),
                BranchResources.HallUpdatedDescription(currentUser.Login, hall.Name),
                oldState,
                SerializeHallAuditState(hall)),
            cancellationToken);

        var updatedHall = await LoadHallSnapshotAsync(hall.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated hall '{hall.Id}' was not found.");

        return TypedResults.Ok(MapHall(updatedHall));
    }

    private static async Task<Results<Ok<HallResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> ArchiveHallAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return await UpdateHallArchiveStateAsync(
            id,
            true,
            BranchAuditConstants.HallArchivedAction,
            BranchResources.HallArchivedDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static async Task<Results<Ok<HallResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> RestoreHallAsync(
        Guid id,
        HttpContext httpContext,
        GymCrmDbContext dbContext,
        IAuditLogService auditLogService,
        IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        return await UpdateHallArchiveStateAsync(
            id,
            false,
            BranchAuditConstants.HallRestoredAction,
            BranchResources.HallRestoredDescription,
            httpContext,
            dbContext,
            auditLogService,
            antiforgery,
            cancellationToken);
    }

    private static async Task<Results<Ok<HallResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> UpdateHallArchiveStateAsync(
        Guid id,
        bool isArchived,
        string actionType,
        Func<string, string, string> descriptionFactory,
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

        var hall = await dbContext.Halls.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (hall is null)
        {
            return TypedResults.NotFound();
        }

        if (isArchived && await IsHallReferencedByGroupsAsync(id, dbContext, cancellationToken))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hall"] = [BranchResources.HallCannotBeArchivedWithGroups]
            });
        }

        if (hall.IsArchived == isArchived)
        {
            var currentHall = await LoadHallSnapshotAsync(hall.Id, dbContext, cancellationToken)
                ?? throw new InvalidOperationException($"Hall '{hall.Id}' was not found after archive state check.");
            return TypedResults.Ok(MapHall(currentHall));
        }

        var oldState = SerializeHallAuditState(hall);
        hall.IsArchived = isArchived;
        hall.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                actionType,
                BranchAuditConstants.HallEntityType,
                hall.Id.ToString(),
                descriptionFactory(currentUser.Login, hall.Name),
                oldState,
                SerializeHallAuditState(hall)),
            cancellationToken);

        var updatedHall = await LoadHallSnapshotAsync(hall.Id, dbContext, cancellationToken)
            ?? throw new InvalidOperationException($"Updated hall '{hall.Id}' was not found.");

        return TypedResults.Ok(MapHall(updatedHall));
    }

    private static async Task<Results<NoContent, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult>> DeleteHallAsync(
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

        var hall = await dbContext.Halls.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (hall is null)
        {
            return TypedResults.NotFound();
        }

        if (await IsHallReferencedByGroupsAsync(id, dbContext, cancellationToken))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hall"] = [BranchResources.HallCannotBeDeletedWithGroups]
            });
        }

        var oldState = SerializeHallAuditState(hall);
        dbContext.Halls.Remove(hall);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.WriteAsync(
            new AuditLogEntry(
                currentUser.Id,
                BranchAuditConstants.HallDeletedAction,
                BranchAuditConstants.HallEntityType,
                hall.Id.ToString(),
                BranchResources.HallDeletedDescription(currentUser.Login, hall.Name),
                oldState),
            cancellationToken);

        return TypedResults.NoContent();
    }

    private static async Task<Branch?> LoadBranchSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Branches
            .AsNoTracking()
            .Include(branch => branch.Halls)
            .Include(branch => branch.Groups)
            .Include(branch => branch.Clients)
            .AsSplitQuery()
            .SingleOrDefaultAsync(branch => branch.Id == id, cancellationToken);
    }

    private static async Task<Hall?> LoadHallSnapshotAsync(
        Guid id,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.Halls
            .AsNoTracking()
            .Include(hall => hall.Branch)
            .Include(hall => hall.Groups)
            .AsSplitQuery()
            .SingleOrDefaultAsync(hall => hall.Id == id, cancellationToken);
    }

    private static BranchResponse MapBranch(Branch branch)
    {
        return new BranchResponse(
            branch.Id,
            branch.Name,
            branch.Address,
            branch.Description,
            branch.IsArchived,
            branch.Halls.Count,
            branch.Groups.Count,
            branch.Clients.Count,
            branch.CreatedAt,
            branch.UpdatedAt);
    }

    private static HallResponse MapHall(Hall hall)
    {
        return new HallResponse(
            hall.Id,
            hall.BranchId,
            hall.Branch.Name,
            hall.Name,
            hall.Description,
            hall.IsArchived,
            hall.Groups.Count,
            hall.CreatedAt,
            hall.UpdatedAt);
    }

    private static NormalizedBranchRequest NormalizeBranchRequest(UpsertBranchRequest request)
    {
        return new NormalizedBranchRequest(
            request.Name?.Trim() ?? string.Empty,
            NormalizeOptionalText(request.Address),
            NormalizeOptionalText(request.Description));
    }

    private static NormalizedHallRequest NormalizeHallRequest(UpsertHallRequest request)
    {
        return new NormalizedHallRequest(
            request.BranchId,
            request.Name?.Trim() ?? string.Empty,
            NormalizeOptionalText(request.Description));
    }

    private static Dictionary<string, string[]> ValidateBranchRequest(NormalizedBranchRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = [BranchResources.BranchNameRequired];
        }
        else if (request.Name.Length > Branch.NameMaxLength)
        {
            errors["name"] = [BranchResources.BranchNameTooLong(Branch.NameMaxLength)];
        }

        if (request.Address is { Length: > Branch.AddressMaxLength })
        {
            errors["address"] = [BranchResources.BranchAddressTooLong];
        }

        if (request.Description is { Length: > Branch.DescriptionMaxLength })
        {
            errors["description"] = [BranchResources.BranchDescriptionTooLong];
        }

        return errors;
    }

    private static async Task<Dictionary<string, string[]>> ValidateHallRequestAsync(
        NormalizedHallRequest request,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken,
        Guid? existingBranchId = null)
    {
        var errors = new Dictionary<string, string[]>();

        if (!request.BranchId.HasValue || request.BranchId.Value == Guid.Empty)
        {
            errors["branchId"] = [BranchResources.HallBranchRequired];
        }
        else if (existingBranchId.HasValue && request.BranchId.Value != existingBranchId.Value)
        {
            errors["branchId"] = [BranchResources.HallBranchImmutable];
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = [BranchResources.HallNameRequired];
        }
        else if (request.Name.Length > Hall.NameMaxLength)
        {
            errors["name"] = [BranchResources.HallNameTooLong(Hall.NameMaxLength)];
        }

        if (request.Description is { Length: > Hall.DescriptionMaxLength })
        {
            errors["description"] = [BranchResources.HallDescriptionTooLong];
        }

        if (errors.ContainsKey("branchId"))
        {
            return errors;
        }

        var branch = await dbContext.Branches
            .AsNoTracking()
            .Where(candidate => candidate.Id == request.BranchId!.Value)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.IsArchived
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (branch is null)
        {
            errors["branchId"] = [BranchResources.BranchMustExist];
        }
        else if (branch.IsArchived)
        {
            errors["branchId"] = [BranchResources.BranchMustBeActive];
        }

        return errors;
    }

    private static async Task<bool> IsHallReferencedByGroupsAsync(
        Guid hallId,
        GymCrmDbContext dbContext,
        CancellationToken cancellationToken)
    {
        return await dbContext.TrainingGroups
            .AsNoTracking()
            .AnyAsync(group => group.HallId == hallId, cancellationToken);
    }

    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static string SerializeBranchAuditState(Branch branch)
    {
        return JsonSerializer.Serialize(
            new
            {
                branch.Id,
                branch.Name,
                branch.Address,
                branch.Description,
                branch.IsArchived,
                branch.CreatedAt,
                branch.UpdatedAt
            },
            AuditSerializerOptions);
    }

    private static string SerializeHallAuditState(Hall hall)
    {
        return JsonSerializer.Serialize(
            new
            {
                hall.Id,
                hall.BranchId,
                hall.Name,
                hall.Description,
                hall.IsArchived,
                hall.CreatedAt,
                hall.UpdatedAt
            },
            AuditSerializerOptions);
    }

    private sealed record NormalizedBranchRequest(
        string Name,
        string? Address,
        string? Description);

    private sealed record NormalizedHallRequest(
        Guid? BranchId,
        string Name,
        string? Description);
}
