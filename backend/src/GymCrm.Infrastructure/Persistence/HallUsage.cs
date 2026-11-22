using GymCrm.Domain.Branches;
using Microsoft.EntityFrameworkCore;

namespace GymCrm.Infrastructure.Persistence;

public sealed record HallUsage(Hall Hall, bool HasGroups, bool HasSchedule)
{
    public static async Task<HallUsage?> LoadForUpdateAsync(GymCrmDbContext db, Guid id, CancellationToken cancellationToken)
    {
        if (db.Database.IsNpgsql())
        {
            // FK inserts take KEY SHARE on the hall. Wait before reading their committed links.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"""SELECT 1 FROM "Halls" WHERE "Id" = {id} FOR UPDATE""", cancellationToken);
        }

        return await db.Halls.Where(hall => hall.Id == id)
            .Select(hall => new HallUsage(hall,
                hall.Groups.Any(),
                db.LessonScheduleSlots.Any(slot => slot.HallId == hall.Id) ||
                db.LessonOccurrences.Any(lesson => lesson.HallId == hall.Id)))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
