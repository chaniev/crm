using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GymCrm.Api.Auth;

internal static class AccessEndpoints
{
    public static IEndpointRouteBuilder MapAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(AccessApiConstants.RoutePrefix).RequireAuthorization();

        group.MapGet(AccessApiConstants.UserManagementRoute, ProbeUserManagement)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageUsers);

        group.MapGet(AccessApiConstants.ClientManagementRoute, ProbeClientManagement)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageClients);

        group.MapGet(AccessApiConstants.GroupManagementRoute, ProbeGroupManagement)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ManageGroups);

        group.MapGet(AccessApiConstants.AuditLogRoute, ProbeAuditLog)
            .RequireAuthorization(GymCrmAuthorizationPolicies.ViewAuditLog);

        group.MapPost(AccessApiConstants.AttendanceRoute, ProbeAttendanceAccessAsync)
            .RequireAuthorization(GymCrmAuthorizationPolicies.MarkAttendance);

        return endpoints;
    }

    private static Ok<CapabilityProbeResponse> ProbeUserManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            AccessApiConstants.UserManagementCapability,
            AccessResources.UserManagementDetail,
            GymCrmAuthorizationPolicies.ManageUsers));
    }

    private static Ok<CapabilityProbeResponse> ProbeClientManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            AccessApiConstants.ClientManagementCapability,
            AccessResources.ClientManagementDetail,
            GymCrmAuthorizationPolicies.ManageClients));
    }

    private static Ok<CapabilityProbeResponse> ProbeGroupManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            AccessApiConstants.GroupManagementCapability,
            AccessResources.GroupManagementDetail,
            GymCrmAuthorizationPolicies.ManageGroups));
    }

    private static Ok<CapabilityProbeResponse> ProbeAuditLog()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            AccessApiConstants.AuditLogCapability,
            AccessResources.AuditLogDetail,
            GymCrmAuthorizationPolicies.ViewAuditLog));
    }

    private static async Task<Results<Ok<GroupAccessProbeResponse>, NotFound, ForbidHttpResult>> ProbeAttendanceAccessAsync(
        Guid groupId,
        HttpContext httpContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var user = httpContext.GetAuthenticatedGymCrmUser();
        if (user is null)
        {
            return TypedResults.Forbid();
        }

        var accessDecision = await accessScopeService.EvaluateGroupAccessAsync(
            user,
            groupId,
            cancellationToken);

        return accessDecision switch
        {
            GroupAccessDecision.GroupNotFound => TypedResults.NotFound(),
            GroupAccessDecision.Forbidden => TypedResults.Forbid(),
            GroupAccessDecision.Allowed => TypedResults.Ok(new GroupAccessProbeResponse(
                groupId,
                AccessApiConstants.AttendanceCapability,
                user.Role == UserRole.HeadCoach
                    ? GymCrmAuthorizationPolicies.MarkAttendance
                    : AccessApiConstants.AssignedCoachScopeGrantedBy)),
            _ => throw new InvalidOperationException($"Unsupported access decision '{accessDecision}'.")
        };
    }

    private sealed record CapabilityProbeResponse(
        string Capability,
        string Detail,
        string GrantedBy);

    private sealed record GroupAccessProbeResponse(
        Guid GroupId,
        string Capability,
        string GrantedBy);
}
