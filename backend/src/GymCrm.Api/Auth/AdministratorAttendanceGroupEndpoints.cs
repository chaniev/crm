using GymCrm.Application.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace GymCrm.Api.Auth;

internal static class AdministratorAttendanceGroupEndpoints
{
    public static IEndpointRouteBuilder MapAdministratorAttendanceGroupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/settings/administrators")
            .RequireAuthorization();

        group.MapGet("/{administratorId:guid}/attendance-groups", GetAsync);
        group.MapPut("/{administratorId:guid}/attendance-groups", PutAsync);

        return endpoints;
    }

    private static async Task<IResult> GetAsync(
        Guid administratorId,
        HttpContext httpContext,
        IAdministratorAttendanceGroupGrantService grantService,
        CancellationToken cancellationToken)
    {
        var currentUser = httpContext.GetAuthenticatedGymCrmUser();
        if (currentUser is null)
        {
            return Results.Unauthorized();
        }

        return MapServiceResult(await grantService.GetAsync(administratorId, currentUser, cancellationToken));
    }

    private static async Task<IResult> PutAsync(
        Guid administratorId,
        AdministratorAttendanceGroupsUpdateRequest request,
        HttpContext httpContext,
        IAdministratorAttendanceGroupGrantService grantService,
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
            return Results.Unauthorized();
        }

        var groupIds = NormalizeSet(request.GroupIds, "groupIds");
        var expectedGroupIds = NormalizeSet(request.ExpectedGroupIds, "expectedGroupIds");
        var validationErrors = MergeErrors(groupIds.Errors, expectedGroupIds.Errors);
        if (validationErrors.Count > 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        return MapServiceResult(await grantService.UpdateAsync(
            administratorId,
            currentUser,
            groupIds.Values,
            expectedGroupIds.Values,
            cancellationToken));
    }

    private static IResult MapServiceResult(AdministratorAttendanceGroupGrantServiceResult result)
    {
        if (result.Response is not null)
        {
            return Results.Ok(result.Response);
        }

        return result.Error switch
        {
            AdministratorAttendanceGroupGrantServiceError.NotFound => StaffProblemDetails.NotFound(),
            AdministratorAttendanceGroupGrantServiceError.Forbidden => StaffProblemDetails.FromDenial(
                GymCrm.Application.Authorization.StaffAuthorizationDenial.StaffManagementForbidden),
            AdministratorAttendanceGroupGrantServiceError.Validation => Results.ValidationProblem(result.ValidationErrors!),
            AdministratorAttendanceGroupGrantServiceError.ConcurrencyConflict => Problem(
                StatusCodes.Status409Conflict,
                "/problems/attendance-grant-concurrency-conflict",
                "Attendance grant scope was changed by another manager.",
                "attendance_grant_concurrency_conflict"),
            AdministratorAttendanceGroupGrantServiceError.BranchForbidden => Problem(
                StatusCodes.Status403Forbidden,
                "/problems/attendance-grant-branch-forbidden",
                "Attendance grant group belongs to another branch.",
                "attendance_grant_branch_forbidden"),
            AdministratorAttendanceGroupGrantServiceError.InactiveResource => Problem(
                StatusCodes.Status409Conflict,
                "/problems/attendance-grant-inactive-resource",
                "Attendance grant resource is inactive.",
                "attendance_grant_inactive_resource"),
            _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }

    private static NormalizedSet NormalizeSet(IReadOnlyList<Guid>? ids, string field)
    {
        if (ids is null)
        {
            return new NormalizedSet([], new Dictionary<string, string[]> { [field] = ["Field is required."] });
        }

        if (ids.Any(id => id == Guid.Empty))
        {
            return new NormalizedSet([], new Dictionary<string, string[]> { [field] = ["Empty group id is not allowed."] });
        }

        var duplicates = ids.GroupBy(id => id).Where(group => group.Count() > 1).Select(group => group.Key).ToArray();
        if (duplicates.Length > 0)
        {
            return new NormalizedSet([], new Dictionary<string, string[]> { [field] = ["Duplicate group id is not allowed."] });
        }

        return new NormalizedSet(ids.Order().ToArray(), []);
    }

    private static Dictionary<string, string[]> MergeErrors(params Dictionary<string, string[]>[] errorSets)
    {
        return errorSets
            .SelectMany(errors => errors)
            .ToDictionary(error => error.Key, error => error.Value);
    }

    private static IResult Problem(int status, string type, string title, string code)
    {
        return Results.Problem(new ProblemDetails
        {
            Status = status,
            Type = type,
            Title = title,
            Extensions = { ["code"] = code }
        });
    }

    private sealed record NormalizedSet(Guid[] Values, Dictionary<string, string[]> Errors);
}

internal sealed record AdministratorAttendanceGroupsUpdateRequest(
    IReadOnlyList<Guid>? ExpectedGroupIds,
    IReadOnlyList<Guid>? GroupIds);
