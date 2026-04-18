using GymCrm.Domain.Users;
using Microsoft.AspNetCore.Authorization;

namespace GymCrm.Api.Auth;

internal static class GymCrmAuthorizationPolicies
{
    public const string ManageUsers = "gym-crm.manage-users";
    public const string ManageClients = "gym-crm.manage-clients";
    public const string ViewClients = "gym-crm.view-clients";
    public const string ViewClientPhotos = "gym-crm.view-client-photos";
    public const string ManageGroups = "gym-crm.manage-groups";
    public const string ViewAuditLog = "gym-crm.view-audit-log";
    public const string MarkAttendance = "gym-crm.mark-attendance";

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
            ViewClients,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Administrator.ToString(),
                UserRole.Coach.ToString()));

        options.AddPolicy(
            ViewClientPhotos,
            policy => policy.RequireRole(
                UserRole.HeadCoach.ToString(),
                UserRole.Administrator.ToString(),
                UserRole.Coach.ToString()));

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
