using GymCrm.Domain.Schedule;
using GymCrm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Tests;

public sealed class LessonCalendarPersistenceModelTests
{
    [Fact]
    public void Lesson_calendar_migration_is_discoverable_and_snapshot_is_current()
    {
        using var dbContext = CreateDbContext();

        Assert.Contains(
            "20260823143000_AddLessonCalendarSchema",
            dbContext.Database.GetMigrations());

        var migrationsAssembly = dbContext.GetService<IMigrationsAssembly>();
        var modelDiffer = dbContext.GetService<IMigrationsModelDiffer>();
        var modelRuntimeInitializer = dbContext.GetService<IModelRuntimeInitializer>();
        var snapshot = migrationsAssembly.ModelSnapshot;

        Assert.NotNull(snapshot);
        Assert.False(
            modelDiffer.HasDifferences(
                modelRuntimeInitializer.Initialize(snapshot.Model).GetRelationalModel(),
                dbContext.GetService<IDesignTimeModel>().Model.GetRelationalModel()));
    }

    [Fact]
    public void Lesson_calendar_schema_uses_postgresql_xmin_rowversions_and_slot_lineage_constraints()
    {
        using var dbContext = CreateDbContext();
        var script = dbContext.GetService<IMigrator>().GenerateScript(
            "20260721210111_FixClientMembershipVersionConstraints",
            "20260823143000_AddLessonCalendarSchema");

        Assert.Contains("CREATE TABLE \"LessonSeries\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"LessonScheduleRuleVersions\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"LessonScheduleSlots\"", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE \"LessonOccurrences\"", script, StringComparison.Ordinal);
        Assert.DoesNotContain("\"xmin\" xid NOT NULL", ExtractCreateTable(script, "LessonSeries"), StringComparison.Ordinal);
        Assert.DoesNotContain("\"xmin\" xid NOT NULL", ExtractCreateTable(script, "LessonOccurrences"), StringComparison.Ordinal);
        Assert.DoesNotContain("\"Version\" xid", script, StringComparison.Ordinal);
        Assert.Contains("IX_LessonSeries_GroupId", script, StringComparison.Ordinal);
        Assert.Contains(
            "IX_LessonScheduleSlots_LessonScheduleRuleVersionId_SlotL",
            script,
            StringComparison.Ordinal);

        var series = dbContext.Model.FindEntityType(typeof(LessonSeries));
        var occurrence = dbContext.Model.FindEntityType(typeof(LessonOccurrence));
        var slot = dbContext.Model.FindEntityType(typeof(LessonScheduleSlot));

        Assert.NotNull(series);
        Assert.NotNull(occurrence);
        Assert.NotNull(slot);
        Assert.Equal("xmin", series.FindProperty(nameof(LessonSeries.Version))!.GetColumnName());
        Assert.Equal("xmin", occurrence.FindProperty(nameof(LessonOccurrence.Version))!.GetColumnName());
        Assert.Contains(
            slot.GetIndexes(),
            index => index.IsUnique &&
                     index.Properties.Select(property => property.Name).SequenceEqual([
                         nameof(LessonScheduleSlot.LessonScheduleRuleVersionId),
                         nameof(LessonScheduleSlot.SlotLineageId)
                     ]));
    }

    private static string ExtractCreateTable(string script, string tableName)
    {
        var start = script.IndexOf($"CREATE TABLE \"{tableName}\"", StringComparison.Ordinal);
        Assert.True(start >= 0, $"Expected {tableName} table in generated schema script.");
        var end = script.IndexOf(");", start, StringComparison.Ordinal);
        Assert.True(end > start, $"Expected end of {tableName} create table statement.");
        return script[start..end];
    }

    private static GymCrmDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GymCrmDbContext>()
            .UseNpgsql("Host=localhost;Database=gym_crm_model_tests;Username=unused;Password=unused")
            .Options;

        return new GymCrmDbContext(options);
    }
}
