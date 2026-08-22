using GymCrm.Api.Auth;
using GymCrm.Application.Authorization;
using GymCrm.Domain.Users;
using Microsoft.AspNetCore.Http;

namespace GymCrm.Tests;

public class UserRoleAuthorizationPolicyTests
{
    [Fact]
    public void Capability_matrix_grants_super_administrator_global_operations_without_head_coach_only_privileges()
    {
        var permissions = UserRoleAuthorizationPolicy.GetPermissions(UserRole.SuperAdministrator);

        Assert.True(permissions.CanManageUsers);
        Assert.True(permissions.CanManageClients);
        Assert.True(permissions.CanManageGroups);
        Assert.True(permissions.CanManageSettings);
        Assert.True(permissions.CanMarkAttendance);
        Assert.True(permissions.CanViewAuditLog);
        Assert.False(permissions.CanViewFinancialReports);
        Assert.False(UserRoleAuthorizationPolicy.CanBootstrap(UserRole.SuperAdministrator));
    }

    [Fact]
    public void Super_administrator_is_capability_superset_of_administrator()
    {
        foreach (var capability in Enum.GetValues<CrmCapability>())
        {
            if (!UserRoleAuthorizationPolicy.HasCapability(UserRole.Administrator, capability))
            {
                continue;
            }

            Assert.True(
                UserRoleAuthorizationPolicy.HasCapability(UserRole.SuperAdministrator, capability),
                $"SuperAdministrator must include Administrator capability '{capability}'.");
        }
    }

    [Fact]
    public void Task080_administrator_is_route_eligible_for_attendance_without_implying_global_scope()
    {
        var permissions = UserRoleAuthorizationPolicy.GetPermissions(UserRole.Administrator);

        Assert.True(permissions.CanMarkAttendance);
        Assert.True(UserRoleAuthorizationPolicy.HasCapability(UserRole.Administrator, CrmCapability.MarkAttendance));
        Assert.Equal(AccessScopeKind.Branch, UserRoleAuthorizationPolicy.GetOperationalScopeKind(UserRole.Administrator));
    }

    [Fact]
    public void Staff_create_matrix_is_exhaustive()
    {
        foreach (var actor in Enum.GetValues<UserRole>())
        {
            foreach (var requestedRole in Enum.GetValues<UserRole>())
            {
                var decision = UserRoleAuthorizationPolicy.CanCreateStaff(actor, requestedRole);
                var expectedAllowed =
                    actor == UserRole.HeadCoach &&
                    requestedRole is UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach ||
                    actor == UserRole.SuperAdministrator &&
                    requestedRole is UserRole.Administrator or UserRole.Coach;
                var expectedDenial = actor is UserRole.Administrator or UserRole.Coach
                    ? StaffAuthorizationDenial.StaffManagementForbidden
                    : StaffAuthorizationDenial.RoleTransitionForbidden;

                Assert.Equal(expectedAllowed, decision.Allowed);
                Assert.Equal(
                    expectedAllowed ? StaffAuthorizationDenial.None : expectedDenial,
                    decision.Denial);
            }
        }
    }

    [Fact]
    public void Staff_read_and_action_matrix_is_exhaustive()
    {
        foreach (var actor in Enum.GetValues<UserRole>())
        {
            foreach (var target in Enum.GetValues<UserRole>())
            {
                var canRead = actor is UserRole.HeadCoach or UserRole.SuperAdministrator;
                Assert.Equal(canRead, UserRoleAuthorizationPolicy.CanReadStaff(actor, target));

                var expectedActions = actor switch
                {
                    UserRole.HeadCoach when target == UserRole.HeadCoach =>
                        new[] { StaffMutationAction.Edit },
                    UserRole.HeadCoach when target == UserRole.Administrator =>
                        new[]
                        {
                            StaffMutationAction.Edit,
                            StaffMutationAction.Deactivate,
                            StaffMutationAction.Reactivate,
                            StaffMutationAction.ManageAttendanceScope
                        },
                    UserRole.HeadCoach =>
                        new[]
                        {
                            StaffMutationAction.Edit,
                            StaffMutationAction.Deactivate,
                            StaffMutationAction.Reactivate
                        },
                    UserRole.SuperAdministrator when target == UserRole.Administrator =>
                        new[]
                        {
                            StaffMutationAction.Edit,
                            StaffMutationAction.Deactivate,
                            StaffMutationAction.Reactivate,
                            StaffMutationAction.ManageAttendanceScope
                        },
                    UserRole.SuperAdministrator when target == UserRole.Coach =>
                        new[]
                        {
                            StaffMutationAction.Edit,
                            StaffMutationAction.Deactivate,
                            StaffMutationAction.Reactivate
                        },
                    _ => []
                };

                Assert.Equal(
                    expectedActions,
                    UserRoleAuthorizationPolicy.GetAllowedTargetActions(actor, target, isSelfTarget: false));
                Assert.Empty(UserRoleAuthorizationPolicy.GetAllowedTargetActions(actor, target, isSelfTarget: true));
            }
        }
    }

    [Fact]
    public void Staff_update_and_role_assignment_matrix_is_exhaustive()
    {
        foreach (var actor in Enum.GetValues<UserRole>())
        {
            foreach (var target in Enum.GetValues<UserRole>())
            {
                foreach (var requestedRole in Enum.GetValues<UserRole>())
                {
                    var decision = UserRoleAuthorizationPolicy.CanUpdateStaff(
                        actor,
                        target,
                        requestedRole,
                        isSelfTarget: false);
                    var expected = ExpectedNonSelfUpdate(actor, target, requestedRole);

                    Assert.Equal(expected.Allowed, decision.Allowed);
                    Assert.Equal(expected.Denial, decision.Denial);
                }
            }
        }

        foreach (var actor in Enum.GetValues<UserRole>())
        {
            foreach (var requestedRole in Enum.GetValues<UserRole>())
            {
                var decision = UserRoleAuthorizationPolicy.CanUpdateStaff(
                    actor,
                    actor,
                    requestedRole,
                    isSelfTarget: true);
                var headCoachSelfEdit =
                    actor == UserRole.HeadCoach &&
                    requestedRole == UserRole.HeadCoach;

                Assert.Equal(headCoachSelfEdit, decision.Allowed);
                Assert.Equal(
                    headCoachSelfEdit
                        ? StaffAuthorizationDenial.None
                        : actor is UserRole.Administrator or UserRole.Coach
                            ? StaffAuthorizationDenial.StaffManagementForbidden
                            : StaffAuthorizationDenial.SelfMutationForbidden,
                    decision.Denial);
            }
        }
    }

    [Fact]
    public void Super_administrator_can_read_protected_targets_but_has_no_mutation_actions()
    {
        var headCoachActions = UserRoleAuthorizationPolicy.GetAllowedTargetActions(
            UserRole.SuperAdministrator,
            UserRole.HeadCoach,
            isSelfTarget: false);
        var peerActions = UserRoleAuthorizationPolicy.GetAllowedTargetActions(
            UserRole.SuperAdministrator,
            UserRole.SuperAdministrator,
            isSelfTarget: false);

        Assert.Empty(headCoachActions);
        Assert.Empty(peerActions);
        Assert.True(UserRoleAuthorizationPolicy.CanReadStaff(UserRole.SuperAdministrator, UserRole.HeadCoach));
        Assert.True(UserRoleAuthorizationPolicy.CanReadStaff(UserRole.SuperAdministrator, UserRole.SuperAdministrator));
    }

    [Fact]
    public void Create_and_update_role_options_are_backend_owned()
    {
        Assert.Equal(
            [UserRole.Administrator, UserRole.Coach, UserRole.SuperAdministrator],
            UserRoleAuthorizationPolicy.GetCreateRoleOptions(UserRole.HeadCoach));
        Assert.Equal(
            [UserRole.Administrator, UserRole.Coach],
            UserRoleAuthorizationPolicy.GetCreateRoleOptions(UserRole.SuperAdministrator));

        Assert.Equal(
            [UserRole.SuperAdministrator],
            UserRoleAuthorizationPolicy.GetUpdateRoleOptions(
                UserRole.HeadCoach,
                UserRole.SuperAdministrator,
                isSelfTarget: false));
        Assert.Empty(UserRoleAuthorizationPolicy.GetUpdateRoleOptions(
            UserRole.SuperAdministrator,
            UserRole.HeadCoach,
            isSelfTarget: false));
    }

    [Fact]
    public void Staff_problem_details_include_stable_branch_scope_denial()
    {
        var result = StaffProblemDetails.FromDenial(StaffAuthorizationDenial.BranchScopeForbidden);

        Assert.Equal(StatusCodes.Status403Forbidden, result.ProblemDetails.Status);
        Assert.Equal("/problems/branch-scope-forbidden", result.ProblemDetails.Type);
        Assert.Equal("branch_scope_forbidden", result.ProblemDetails.Extensions["code"]);
    }

    [Fact]
    public void Existing_super_administrator_role_is_immutable_for_head_coach()
    {
        foreach (var destinationRole in Enum.GetValues<UserRole>().Where(role => role != UserRole.SuperAdministrator))
        {
            var decision = UserRoleAuthorizationPolicy.CanUpdateStaff(
                UserRole.HeadCoach,
                UserRole.SuperAdministrator,
                destinationRole,
                isSelfTarget: false);

            Assert.False(decision.Allowed);
            Assert.Equal(StaffAuthorizationDenial.RoleTransitionForbidden, decision.Denial);
        }
    }

    [Theory]
    [InlineData(UserRole.HeadCoach, UserRole.HeadCoach)]
    [InlineData(UserRole.SuperAdministrator, UserRole.Coach)]
    public void Super_administrator_protected_target_mutations_are_target_denials(
        UserRole protectedTargetRole,
        UserRole requestedTargetRole)
    {
        var decision = UserRoleAuthorizationPolicy.CanUpdateStaff(
            UserRole.SuperAdministrator,
            protectedTargetRole,
            requestedTargetRole,
            isSelfTarget: false);

        Assert.False(decision.Allowed);
        Assert.Equal(StaffAuthorizationDenial.TargetForbidden, decision.Denial);
    }

    [Theory]
    [InlineData(UserRole.HeadCoach, AccessScopeKind.Global)]
    [InlineData(UserRole.SuperAdministrator, AccessScopeKind.Global)]
    [InlineData(UserRole.Administrator, AccessScopeKind.Branch)]
    [InlineData(UserRole.Coach, AccessScopeKind.AssignedGroups)]
    public void Operational_scope_kind_is_role_owned(UserRole role, AccessScopeKind expectedScopeKind)
    {
        Assert.Equal(expectedScopeKind, UserRoleAuthorizationPolicy.GetOperationalScopeKind(role));
    }

    private static StaffAuthorizationDecision ExpectedNonSelfUpdate(
        UserRole actor,
        UserRole target,
        UserRole requestedRole)
    {
        if (actor is UserRole.Administrator or UserRole.Coach)
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.StaffManagementForbidden);
        }

        if (actor == UserRole.SuperAdministrator &&
            target is UserRole.SuperAdministrator or UserRole.HeadCoach)
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.TargetForbidden);
        }

        if (target == UserRole.SuperAdministrator && requestedRole != UserRole.SuperAdministrator)
        {
            return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden);
        }

        if (target == UserRole.HeadCoach)
        {
            return actor == UserRole.HeadCoach && requestedRole == UserRole.HeadCoach
                ? StaffAuthorizationDecision.Allow()
                : StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.TargetForbidden);
        }

        if (actor == UserRole.HeadCoach &&
            requestedRole is UserRole.SuperAdministrator or UserRole.Administrator or UserRole.Coach)
        {
            return StaffAuthorizationDecision.Allow();
        }

        if (actor == UserRole.SuperAdministrator &&
            target is UserRole.Administrator or UserRole.Coach &&
            requestedRole == target)
        {
            return StaffAuthorizationDecision.Allow();
        }

        return StaffAuthorizationDecision.Deny(StaffAuthorizationDenial.RoleTransitionForbidden);
    }
}
