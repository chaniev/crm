using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GymCrm.Infrastructure.Persistence.Migrations;

[DbContext(typeof(GymCrmDbContext))]
[Migration("20261116010000_UseInclusiveTrainerPeriods")]
public sealed class UseInclusiveTrainerPeriods : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Lock before preflight so another writer cannot invalidate the checked history.
        migrationBuilder.Sql("LOCK TABLE \"GroupTrainerAssignments\" IN ACCESS EXCLUSIVE MODE");
        migrationBuilder.Sql("""
            DO $$
            DECLARE conflicts text;
            BEGIN
                SELECT string_agg(pair, '; ') INTO conflicts FROM (
                    SELECT a."Id"::text || '/' || b."Id"::text AS pair
                    FROM "GroupTrainerAssignments" a
                    JOIN "GroupTrainerAssignments" b ON a."Id" < b."Id"
                        AND a."TrainerId" = b."TrainerId" AND a."GroupId" = b."GroupId"
                    WHERE daterange(a."ValidFrom", a."ValidTo", '[]') && daterange(b."ValidFrom", b."ValidTo", '[]')
                    ORDER BY a."Id", b."Id" LIMIT 20
                ) overlapping;
                IF conflicts IS NOT NULL THEN
                    RAISE EXCEPTION 'trainer-period-overlap: inclusive history conflicts: %. No rows were changed; resolve history explicitly before retrying.', conflicts;
                END IF;
            END $$;
            """);
        migrationBuilder.DropCheckConstraint("CK_GroupTrainerAssignments_Period_NonEmpty", "GroupTrainerAssignments");
        migrationBuilder.AddCheckConstraint("CK_GroupTrainerAssignments_Period_NonEmpty", "GroupTrainerAssignments", "\"ValidTo\" IS NULL OR \"ValidTo\" >= \"ValidFrom\"");
        ReplaceExclusion(migrationBuilder, "[]");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("LOCK TABLE \"GroupTrainerAssignments\" IN ACCESS EXCLUSIVE MODE");
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM "GroupTrainerAssignments" WHERE "ValidTo" = "ValidFrom") THEN
                    RAISE EXCEPTION 'trainer-period-downgrade-blocked: one-day history cannot fit the former constraint. No rows were changed; use a forward fix.';
                END IF;
            END $$;
            """);
        ReplaceExclusion(migrationBuilder, "[)");
        migrationBuilder.DropCheckConstraint("CK_GroupTrainerAssignments_Period_NonEmpty", "GroupTrainerAssignments");
        migrationBuilder.AddCheckConstraint("CK_GroupTrainerAssignments_Period_NonEmpty", "GroupTrainerAssignments", "\"ValidTo\" IS NULL OR \"ValidTo\" > \"ValidFrom\"");
    }

    private static void ReplaceExclusion(MigrationBuilder migrationBuilder, string bounds)
    {
        migrationBuilder.Sql("ALTER TABLE \"GroupTrainerAssignments\" DROP CONSTRAINT \"EX_GroupTrainerAssignments_TrainerGroup_Period_NoOverlap\"");
        migrationBuilder.Sql($"""
            ALTER TABLE "GroupTrainerAssignments"
            ADD CONSTRAINT "EX_GroupTrainerAssignments_TrainerGroup_Period_NoOverlap"
            EXCLUDE USING gist (
                "TrainerId" WITH =, "GroupId" WITH =,
                daterange("ValidFrom", "ValidTo", '{bounds}') WITH &&
            )
            """);
    }
}
