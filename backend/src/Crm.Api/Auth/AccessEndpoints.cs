using Crm.Application.Authorization;
using Crm.Domain.Users;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Crm.Api.Auth;

internal static class AccessEndpoints
{
    public static IEndpointRouteBuilder MapAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/access").RequireAuthorization();

        group.MapGet("/user-management", ProbeUserManagement)
            .RequireAuthorization(CrmAuthorizationPolicies.ManageUsers);

        group.MapGet("/client-management", ProbeClientManagement)
            .RequireAuthorization(CrmAuthorizationPolicies.ManageClients);

        group.MapGet("/group-management", ProbeGroupManagement)
            .RequireAuthorization(CrmAuthorizationPolicies.ManageGroups);

        group.MapGet("/audit-log", ProbeAuditLog)
            .RequireAuthorization(CrmAuthorizationPolicies.ViewAuditLog);

        group.MapPost("/attendance/{groupId:guid}", ProbeAttendanceAccessAsync)
            .RequireAuthorization(CrmAuthorizationPolicies.MarkAttendance);

        return endpoints;
    }

    private static Ok<CapabilityProbeResponse> ProbeUserManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            "UserManagement",
            "Backend подтверждает доступ к управлению пользователями.",
            "HeadCoachPolicy"));
    }

    private static Ok<CapabilityProbeResponse> ProbeClientManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            "ClientManagement",
            "Backend подтверждает доступ к управлению клиентами.",
            "HeadCoachOrAdministratorPolicy"));
    }

    private static Ok<CapabilityProbeResponse> ProbeGroupManagement()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            "GroupManagement",
            "Backend подтверждает доступ к управлению группами.",
            "HeadCoachOrAdministratorPolicy"));
    }

    private static Ok<CapabilityProbeResponse> ProbeAuditLog()
    {
        return TypedResults.Ok(new CapabilityProbeResponse(
            "AuditLog",
            "Backend подтверждает доступ к журналу действий.",
            "HeadCoachOrAdministratorPolicy"));
    }

    private static async Task<Results<Ok<GroupAccessProbeResponse>, NotFound, ForbidHttpResult>> ProbeAttendanceAccessAsync(
        Guid groupId,
        HttpContext httpContext,
        IAccessScopeService accessScopeService,
        CancellationToken cancellationToken)
    {
        var user = httpContext.GetAuthenticatedCrmUser();
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
                "Attendance",
                user.Role == UserRole.HeadCoach ? "HeadCoachPolicy" : "AssignedCoachScope")),
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
