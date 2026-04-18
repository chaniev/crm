using Crm.Domain.Users;
using Microsoft.AspNetCore.Authorization;

namespace Crm.Api.Auth;

internal static class CrmAuthorizationPolicies
{
    public const string ManageUsers = "crm.manage-users";
    public const string ManageClients = "crm.manage-clients";
    public const string ManageGroups = "crm.manage-groups";
    public const string ViewAuditLog = "crm.view-audit-log";
    public const string MarkAttendance = "crm.mark-attendance";

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(
            ManageUsers,
            policy => policy.RequireRole(UserRole.HeadCoach.ToString()));

        options.AddPolicy(
            ManageClients,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Administrator.ToString()));

        options.AddPolicy(
            ManageGroups,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Administrator.ToString()));

        options.AddPolicy(
            ViewAuditLog,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Administrator.ToString()));

        options.AddPolicy(
            MarkAttendance,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Coach.ToString()));
    }
}
