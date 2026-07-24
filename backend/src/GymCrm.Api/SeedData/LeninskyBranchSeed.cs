using GymCrm.Domain.Branches;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Api.SeedData;

internal static class LeninskyBranchSeed
{
    public static async Task<Branch> ResolveAsync(
        GymCrmDbContext dbContext,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var branch = await dbContext.Branches
            .SingleOrDefaultAsync(candidate => candidate.Name == LeninskySeedData.BranchName, cancellationToken);

        if (branch is null)
        {
            branch = new Branch
            {
                Id = LeninskySeedIds.Branch,
                Name = LeninskySeedData.BranchName,
                Description = "Тестовый филиал.",
                IsArchived = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.Branches.Add(branch);
        }
        else
        {
            branch.IsArchived = false;
            branch.UpdatedAt = now;
        }

        return branch;
    }
}
