using System.Security.Claims;
using GymCrm.Application.Attendance;
using GymCrm.Application.Authorization;
using GymCrm.Application.Security;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class StaffPasswordResetService
{
    public static async Task<StaffMutationResult> ResetAsync(
        StaffEndpointRoleFamily family,
        User sessionActor,
        ClaimsPrincipal principal,
        Guid targetId,
        string? temporaryPassword,
        GymCrmDbContext db,
        IBusinessDateProvider dates,
        IPasswordHashService hasher,
        CancellationToken cancellationToken)
    {
        var management = StaffManagementBoundary.AuthorizeManagement(sessionActor, family);
        if (!management.Allowed)
        {
            return StaffMutationResult.Forbidden(management.Denial);
        }

        await using var transaction = db.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory"
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;
        // These locks serialize credential/profile writes and permit concurrent foreign-key references (e.g. audits).
        if (db.Database.IsNpgsql())
        {
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Users" WHERE "Id" IN ({sessionActor.Id}, {targetId}) ORDER BY "Id" FOR NO KEY UPDATE""",
                cancellationToken);
        }

        var actor = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == sessionActor.Id, cancellationToken);
        if (actor is null || actor.MustChangePassword || !AuthSessionSync.IsCurrentSession(principal, actor))
        {
            return new StaffMutationResult(StaffMutationStatus.Unauthorized);
        }

        management = StaffManagementBoundary.AuthorizeManagement(actor, family);
        if (!management.Allowed)
        {
            return StaffMutationResult.Forbidden(management.Denial);
        }

        var target = await db.Users.SingleOrDefaultAsync(u => u.Id == targetId, cancellationToken);
        if (target is null || !StaffEndpointRoleFamilies.Contains(family, target.Role))
        {
            return StaffMutationResult.NotFound();
        }

        var hasAssignment = actor.Role == UserRole.Administrator && actor.BranchId is Guid branchId &&
            await LockAndCheckAssignmentAsync(db, targetId, branchId, dates, cancellationToken);
        var decision = UserRoleAuthorizationPolicy.CanResetPassword(actor.Role, target.Role, actor.Id == targetId, hasAssignment);
        if (!decision.Allowed)
        {
            return StaffMutationResult.Forbidden(decision.Denial);
        }

        if (string.IsNullOrWhiteSpace(temporaryPassword))
        {
            return PasswordError(UserResources.TemporaryPasswordRequired);
        }

        if (target.PasswordResetPending && hasher.VerifyPassword(target, temporaryPassword))
        {
            return PasswordError(UserResources.TemporaryPasswordUnchanged);
        }

        target.PasswordHash = hasher.HashPassword(target, temporaryPassword);
        target.CredentialVersion = Guid.NewGuid();
        target.PasswordResetPending = true;
        target.MustChangePassword = true;
        target.UpdatedAt = DateTimeOffset.UtcNow;
        db.AuditLogs.Add(StaffManagementBoundary.CreateAuditLog(
            actor.Id, UserAuditConstants.PasswordResetAction, target.Id.ToString(),
            UserResources.PasswordResetDescription(actor.Login, target.Login), oldState: null, newState: null));
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return StaffMutationResult.Updated(target);
    }

    private static StaffMutationResult PasswordError(string message) =>
        StaffMutationResult.ValidationFailed(new Dictionary<string, string[]> { ["temporaryPassword"] = [message] });

    private static async Task<bool> LockAndCheckAssignmentAsync(
        GymCrmDbContext db, Guid targetId, Guid branchId, IBusinessDateProvider dates, CancellationToken cancellationToken)
    {
        var assignments = StaffPasswordResetScope.ActiveAssignments(db, branchId, dates.Today)
            .Where(a => a.TrainerId == targetId);
        if (!db.Database.IsNpgsql())
        {
            return await assignments.AnyAsync(cancellationToken);
        }

        var groupIds = await assignments.Select(a => a.GroupId).Distinct().Order().ToListAsync(cancellationToken);
        foreach (var groupId in groupIds)
        {
            // Both assignment and branch changes write this group row before committing.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "TrainingGroups" WHERE "Id" = {groupId} FOR NO KEY UPDATE""",
                cancellationToken);
            if (await StaffPasswordResetScope.ActiveAssignments(db, branchId, dates.Today)
                .AnyAsync(a => a.TrainerId == targetId && a.GroupId == groupId, cancellationToken))
            {
                return true;
            }
        }

        return false;
    }
}
