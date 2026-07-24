using GymCrm.Application.Authorization;
using Microsoft.AspNetCore.Authorization;

namespace GymCrm.Api.Auth;

internal static class GymCrmAuthorizationPolicies
{
    public const string ManageUsers = "gym-crm.manage-users";
    public const string ManageClients = "gym-crm.manage-clients";
    public const string ViewClients = "gym-crm.view-clients";
    public const string ViewClientPhotos = "gym-crm.view-client-photos";
    public const string ManageGroups = "gym-crm.manage-groups";
    public const string ManageSettings = "gym-crm.manage-settings";
    public const string ViewAuditLog = "gym-crm.view-audit-log";
    public const string ViewFinancialReports = "gym-crm.view-financial-reports";
    public const string MarkAttendance = "gym-crm.mark-attendance";
    public const string ViewClientMessenger = "gym-crm.view-client-messenger";
    public const string CreateClientMessengerLink = "gym-crm.create-client-messenger-link";
    public const string ReplyClientMessenger = "gym-crm.reply-client-messenger";

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(
            ManageUsers,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ManageUsers)));

        options.AddPolicy(
            ManageClients,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ManageClients)));

        options.AddPolicy(
            ViewClients,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ViewClients)));

        options.AddPolicy(
            ViewClientPhotos,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ViewClientPhotos)));

        options.AddPolicy(
            ManageGroups,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ManageGroups)));

        options.AddPolicy(
            ManageSettings,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ManageSettings)));

        options.AddPolicy(
            ViewAuditLog,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ViewAuditLog)));

        options.AddPolicy(
            ViewFinancialReports,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ViewFinancialReports)));

        options.AddPolicy(
            MarkAttendance,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.MarkAttendance)));

        options.AddPolicy(
            ViewClientMessenger,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ViewClientMessenger)));

        options.AddPolicy(
            CreateClientMessengerLink,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.CreateClientMessengerLink)));

        options.AddPolicy(
            ReplyClientMessenger,
            policy => policy.RequireRole(GetRoleNames(CrmCapability.ReplyClientMessenger)));
    }

    private static string[] GetRoleNames(CrmCapability capability)
    {
        return UserRoleAuthorizationPolicy.GetRolesForCapability(capability)
            .Select(role => role.ToString())
            .ToArray();
    }
}
