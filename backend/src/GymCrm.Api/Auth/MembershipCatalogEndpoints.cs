using System.Text.Json;
using GymCrm.Application.Attendance;
using GymCrm.Application.Audit;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Memberships;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class MembershipCatalogEndpoints
{
    private const string AuditEntityType = "MembershipCatalogItem";

    public static IEndpointRouteBuilder MapMembershipCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var settings = endpoints.MapGroup("/settings/membership-catalog")
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageSettings);
        settings.MapGet("/", ListAsync);
        settings.MapPost("/", CreateAsync);
        settings.MapPut("/{id:guid}", UpdateAsync);

        endpoints.MapGet("/membership-catalog/eligible", EligibleAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(Guid? branchId, HttpContext context,
        GymCrmDbContext db, CancellationToken cancellationToken)
    {
        var scope = ResolveScope(context.GetAuthenticatedGymCrmUser(), branchId);
        if (!scope.Allowed) return ScopeProblem();
        var items = await db.MembershipCatalogItems.AsNoTracking()
            .Where(item => item.BranchId == scope.BranchId || item.BranchId == null)
            .OrderBy(item => item.BehaviorKind).ThenBy(item => item.Name)
            .Select(item => ToResponse(item)).ToListAsync(cancellationToken);
        if (scope.Role is UserRole.Administrator or UserRole.SuperAdministrator)
            items = items.Where(item => item.BehaviorKind != nameof(MembershipBehaviorKind.Professional)).ToList();
        return TypedResults.Ok(items);
    }

    private static async Task<IResult> EligibleAsync(Guid branchId, HttpContext context,
        IBusinessDateProvider dates, GymCrmDbContext db, CancellationToken cancellationToken)
    {
        var scope = ResolveScope(context.GetAuthenticatedGymCrmUser(), branchId);
        if (!scope.Allowed) return ScopeProblem();
        var today = dates.Today;
        var items = await db.MembershipCatalogItems.AsNoTracking()
            .Where(item => (item.BranchId == branchId || item.BranchId == null) &&
                item.AvailableFrom <= today && (item.AvailableTo == null || item.AvailableTo >= today))
            .OrderBy(item => item.Name).Select(item => ToResponse(item)).ToListAsync(cancellationToken);
        if (scope.Role is UserRole.Administrator or UserRole.SuperAdministrator)
            items = items.Where(item => item.BehaviorKind != nameof(MembershipBehaviorKind.Professional)).ToList();
        return TypedResults.Ok(items);
    }

    private static async Task<IResult> CreateAsync(CreateMembershipCatalogItemRequest request,
        HttpContext context, GymCrmDbContext db, IAuditLogService audit, IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(context, antiforgery);
        if (csrf is not null) return csrf;
        var user = context.GetAuthenticatedGymCrmUser();
        var scope = ResolveScope(user, request.BranchId);
        if (!scope.Allowed) return ScopeProblem();
        if (!Enum.TryParse<MembershipBehaviorKind>(request.BehaviorKind, true, out var behavior) ||
            behavior == MembershipBehaviorKind.Professional)
            return Validation("behaviorKind", "Only SingleVisit or Term can be created.");
        if (!await db.Branches.AnyAsync(branch => branch.Id == request.BranchId && !branch.IsArchived, cancellationToken))
            return Validation("branchId", "Active branch is required.");
        MembershipCatalogItem item;
        try
        {
            item = MembershipCatalogItem.CreateBranchOwned(request.BranchId, request.Name, request.Price,
            behavior, request.AvailableFrom, request.AvailableTo, DateTimeOffset.UtcNow);
        }
        catch (ArgumentException exception) { return Validation("catalog", exception.Message); }
        db.MembershipCatalogItems.Add(item);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return OverlapProblem(); }
        await audit.WriteAsync(new AuditLogEntry(user!.Id, "membership-catalog.created", AuditEntityType,
            item.Id.ToString(), "Membership catalog item created", NewValueJson: JsonSerializer.Serialize(ToResponse(item))), cancellationToken);
        return TypedResults.Created($"/settings/membership-catalog/{item.Id}", ToResponse(item));
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateMembershipCatalogItemRequest request,
        HttpContext context, GymCrmDbContext db, IAuditLogService audit, IAntiforgery antiforgery,
        CancellationToken cancellationToken)
    {
        var csrf = await AuthCsrfValidation.ValidateRequestAsync(context, antiforgery);
        if (csrf is not null) return csrf;
        if (request.AdditionalFields?.Count > 0)
            return Results.Problem(statusCode: 400, title: "Immutable catalog field",
                type: "https://gym-crm.local/problems/membership-catalog-immutable", extensions: new Dictionary<string, object?> { ["code"] = "membership_catalog_immutable" });
        var user = context.GetAuthenticatedGymCrmUser();
        var item = await db.MembershipCatalogItems.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (item is null) return Results.NotFound();
        if (item.BehaviorKind == MembershipBehaviorKind.Professional && user?.Role != UserRole.HeadCoach)
            return ScopeProblem();
        if (item.BranchId is Guid branch && !ResolveScope(user, branch).Allowed) return ScopeProblem();
        var old = JsonSerializer.Serialize(ToResponse(item));
        try { item.Update(request.Name, request.AvailableFrom, request.AvailableTo, DateTimeOffset.UtcNow); }
        catch (ArgumentException exception) { return Validation("catalog", exception.Message); }
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return OverlapProblem(); }
        await audit.WriteAsync(new AuditLogEntry(user!.Id, "membership-catalog.updated", AuditEntityType,
            item.Id.ToString(), "Membership catalog item updated", old, JsonSerializer.Serialize(ToResponse(item))), cancellationToken);
        return TypedResults.Ok(ToResponse(item));
    }

    private static (bool Allowed, Guid? BranchId, UserRole Role) ResolveScope(User? user, Guid? requested) => user switch
    {
        { Role: UserRole.HeadCoach or UserRole.SuperAdministrator } => (requested.HasValue, requested, user.Role),
        { Role: UserRole.Administrator, BranchId: Guid own } when requested == own => (true, own, user.Role),
        _ => (false, null, user?.Role ?? UserRole.Coach)
    };

    private static MembershipCatalogItemResponse ToResponse(MembershipCatalogItem item) => new(item.Id,
        item.BranchId, item.Name, item.Price, item.BehaviorKind.ToString(), item.AvailableFrom, item.AvailableTo, item.IsSystemOwned);
    private static IResult Validation(string field, string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
    private static IResult ScopeProblem() =>
        StaffProblemDetails.FromDenial(StaffAuthorizationDenial.BranchScopeForbidden);
    private static IResult OverlapProblem() => Results.Problem(statusCode: 409, title: "Catalog availability overlaps",
        type: "https://gym-crm.local/problems/membership-catalog-overlap", extensions: new Dictionary<string, object?> { ["code"] = "membership_catalog_overlap" });
}
