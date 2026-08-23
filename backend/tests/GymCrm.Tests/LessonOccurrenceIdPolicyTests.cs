using System.Globalization;
using GymCrm.Application.Scheduling;

namespace GymCrm.Tests;

public class LessonOccurrenceIdPolicyTests
{
    [Fact]
    public void Recurring_uuidv5_vector_matches_calendar_contract()
    {
        var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            new DateOnly(2026, 8, 20));

        Assert.Equal(
            Guid.Parse("6ae07738-e4c4-5f0b-a8c3-24e2349f4e6e"),
            occurrenceId);
    }

    [Fact]
    public void Legacy_attendance_uuidv5_vector_matches_calendar_contract()
    {
        var occurrenceId = LessonOccurrenceIdPolicy.CreateLegacyAttendance(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            new DateOnly(2026, 8, 20));

        Assert.Equal(
            Guid.Parse("a896ae57-b0cb-50de-a308-cb438fc57893"),
            occurrenceId);
    }

    [Fact]
    public void Uuid_generation_uses_invariant_canonical_key()
    {
        var previousCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("tr-TR");

            var occurrenceId = LessonOccurrenceIdPolicy.CreateRecurring(
                Guid.Parse("11111111-1111-1111-1111-111111111111"),
                new DateOnly(2026, 8, 20));

            Assert.Equal(
                Guid.Parse("6ae07738-e4c4-5f0b-a8c3-24e2349f4e6e"),
                occurrenceId);
        }
        finally
        {
            CultureInfo.CurrentCulture = previousCulture;
        }
    }
}
