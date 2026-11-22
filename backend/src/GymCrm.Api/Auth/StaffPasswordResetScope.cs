using GymCrm.Domain.Groups;
using GymCrm.Domain.Users;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.Auth;

internal static class StaffPasswordResetScope
{
    public static IQueryable<GroupTrainerAssignment> ActiveAssignments(GymCrmDbContext db, Guid branchId, DateOnly today)
    {
        return db.GroupTrainerAssignments.Where(assignment =>
            assignment.Group.BranchId == branchId &&
            assignment.ValidFrom <= today && (assignment.ValidTo == null || assignment.ValidTo >= today));
    }

    public static Task<bool> HasAssignmentAsync(
        GymCrmDbContext db, User actor, Guid coachId, DateOnly today, CancellationToken cancellationToken)
    {
        return actor.Role == UserRole.Administrator && actor.BranchId is Guid branchId
            ? ActiveAssignments(db, branchId, today).AnyAsync(a => a.TrainerId == coachId, cancellationToken)
            : Task.FromResult(false);
    }
}
